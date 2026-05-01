use crate::{auth, error::AppError, AppState};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/refresh", post(refresh))
        .route("/api/auth/logout", post(logout))
}

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct TokenResponse {
    access_token: String,
}

async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<(CookieJar, Json<TokenResponse>), AppError> {
    let user = sqlx::query!(
        "SELECT id, password_hash, role FROM users WHERE username = $1",
        payload.username
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    let user_id = user.id;
    let access_token = auth::make_access_token(user_id, &user.role, &state.jwt_secret)
        .map_err(|e| AppError::Internal(e))?;

    let refresh_token = auth::make_refresh_token();
    let token_hash = hash_token(&refresh_token);
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sqlx::query!(
        "INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        token_hash,
        user_id,
        expires_at,
    )
    .execute(&state.pool)
    .await?;

    let cookie = Cookie::build(("refresh_token", refresh_token))
        .http_only(true)
        .same_site(SameSite::Strict)
        .path("/api/auth")
        .max_age(Duration::days(30))
        .build();

    Ok((jar.add(cookie), Json(TokenResponse { access_token })))
}

async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<TokenResponse>, AppError> {
    let refresh_token = jar
        .get("refresh_token")
        .map(|c| c.value().to_string())
        .ok_or(AppError::Unauthorized)?;

    let token_hash = hash_token(&refresh_token);
    let record = sqlx::query!(
        "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1",
        token_hash
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if record.expires_at < OffsetDateTime::now_utc() {
        return Err(AppError::Unauthorized);
    }

    let user = sqlx::query!("SELECT role FROM users WHERE id = $1", record.user_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let access_token =
        auth::make_access_token(record.user_id, &user.role, &state.jwt_secret)
            .map_err(|e| AppError::Internal(e))?;

    Ok(Json(TokenResponse { access_token }))
}

async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, StatusCode), AppError> {
    if let Some(cookie) = jar.get("refresh_token") {
        let token_hash = hash_token(cookie.value());
        sqlx::query!("DELETE FROM refresh_tokens WHERE token_hash = $1", token_hash)
            .execute(&state.pool)
            .await?;
    }

    let removal = Cookie::build(("refresh_token", ""))
        .path("/api/auth")
        .max_age(Duration::seconds(0))
        .build();

    Ok((jar.add(removal), StatusCode::NO_CONTENT))
}

fn hash_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(token.as_bytes());
    format!("{:x}", h.finalize())
}
