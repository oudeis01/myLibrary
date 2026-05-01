use crate::{auth::guards::AdminUser, auth::middleware::AuthUser, error::AppError, AppState};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/me", get(get_me))
        .route("/api/users/:id", patch(update_user).delete(delete_user))
}

#[derive(Serialize)]
struct UserResponse {
    id: Uuid,
    username: String,
    role: String,
    created_at: OffsetDateTime,
}

#[derive(Deserialize)]
struct CreateUserRequest {
    username: String,
    password: String,
    role: Option<String>,
}

#[derive(Deserialize)]
struct UpdateUserRequest {
    role: Option<String>,
    password: Option<String>,
}

fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("password hash error: {e}")))
}

fn validate_role(role: &str) -> Result<(), AppError> {
    if ["admin", "member", "guest"].contains(&role) {
        Ok(())
    } else {
        Err(AppError::BadRequest("invalid role; must be admin, member, or guest".into()))
    }
}

async fn list_users(
    _admin: AdminUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, AppError> {
    let rows = sqlx::query!(
        "SELECT id, username, role, created_at FROM users ORDER BY created_at"
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| UserResponse {
                id: r.id,
                username: r.username,
                role: r.role,
                created_at: r.created_at,
            })
            .collect(),
    ))
}

async fn get_me(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>, AppError> {
    let row = sqlx::query!(
        "SELECT id, username, role, created_at FROM users WHERE id = $1",
        auth.user_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(UserResponse {
        id: row.id,
        username: row.username,
        role: row.role,
        created_at: row.created_at,
    }))
}

async fn create_user(
    _admin: AdminUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    let role = payload.role.unwrap_or_else(|| "member".to_string());
    validate_role(&role)?;

    let password_hash = hash_password(&payload.password)?;

    let row = sqlx::query!(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)
         RETURNING id, username, role, created_at",
        payload.username,
        password_hash,
        role,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(UserResponse {
            id: row.id,
            username: row.username,
            role: row.role,
            created_at: row.created_at,
        }),
    ))
}

async fn update_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    if id != auth.user_id && !auth.is_admin() {
        return Err(AppError::Forbidden);
    }
    if payload.role.is_some() && !auth.is_admin() {
        return Err(AppError::Forbidden);
    }
    if let Some(ref role) = payload.role {
        validate_role(role)?;
    }

    let password_hash = payload.password.as_deref().map(hash_password).transpose()?;

    let row = sqlx::query!(
        r#"UPDATE users SET
             role = COALESCE($1, role),
             password_hash = COALESCE($2, password_hash)
           WHERE id = $3
           RETURNING id, username, role, created_at"#,
        payload.role,
        password_hash,
        id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(UserResponse {
        id: row.id,
        username: row.username,
        role: row.role,
        created_at: row.created_at,
    }))
}

async fn delete_user(
    admin: AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    if id == admin.0.user_id {
        return Err(AppError::BadRequest("cannot delete your own account".into()));
    }

    let result = sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
