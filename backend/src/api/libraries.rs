use crate::{
    auth::guards::{check_library_access, AdminUser},
    auth::middleware::AuthUser,
    error::AppError,
    services::scanner,
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/libraries", get(list_libraries).post(create_library))
        .route(
            "/api/libraries/:id",
            get(get_library).put(update_library).delete(delete_library),
        )
        .route("/api/libraries/:id/scan", post(trigger_scan))
}

#[derive(Serialize)]
struct LibraryResponse {
    id: Uuid,
    name: String,
    path: String,
    created_at: time::OffsetDateTime,
}

#[derive(Deserialize)]
struct CreateLibraryRequest {
    name: String,
    path: String,
}

async fn list_libraries(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<LibraryResponse>>, AppError> {
    let libs: Vec<LibraryResponse> = if auth.is_admin() {
        sqlx::query!("SELECT id, name, path, created_at FROM libraries ORDER BY created_at")
            .fetch_all(&state.pool)
            .await?
            .into_iter()
            .map(|r| LibraryResponse {
                id: r.id,
                name: r.name,
                path: r.path,
                created_at: r.created_at,
            })
            .collect()
    } else {
        sqlx::query!(
            r#"SELECT l.id, l.name, l.path, l.created_at
               FROM libraries l
               JOIN library_permissions lp ON lp.library_id = l.id
               WHERE lp.user_id = $1 AND lp.can_read = true
               ORDER BY l.created_at"#,
            auth.user_id,
        )
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(|r| LibraryResponse {
            id: r.id,
            name: r.name,
            path: r.path,
            created_at: r.created_at,
        })
        .collect()
    };

    Ok(Json(libs))
}

async fn create_library(
    _admin: AdminUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateLibraryRequest>,
) -> Result<(StatusCode, Json<LibraryResponse>), AppError> {
    let row = sqlx::query!(
        "INSERT INTO libraries (name, path) VALUES ($1, $2) RETURNING id, name, path, created_at",
        payload.name,
        payload.path,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(LibraryResponse {
            id: row.id,
            name: row.name,
            path: row.path,
            created_at: row.created_at,
        }),
    ))
}

async fn get_library(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryResponse>, AppError> {
    let row = sqlx::query!(
        "SELECT id, name, path, created_at FROM libraries WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    check_library_access(&state.pool, auth.user_id, id, auth.is_admin()).await?;

    Ok(Json(LibraryResponse {
        id: row.id,
        name: row.name,
        path: row.path,
        created_at: row.created_at,
    }))
}

async fn update_library(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateLibraryRequest>,
) -> Result<Json<LibraryResponse>, AppError> {
    let row = sqlx::query!(
        "UPDATE libraries SET name = $1, path = $2 WHERE id = $3
         RETURNING id, name, path, created_at",
        payload.name,
        payload.path,
        id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(LibraryResponse {
        id: row.id,
        name: row.name,
        path: row.path,
        created_at: row.created_at,
    }))
}

async fn delete_library(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!("DELETE FROM libraries WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn trigger_scan(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let row = sqlx::query!("SELECT path FROM libraries WHERE id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let pool = state.pool.clone();
    let thumbs_path = state.thumbs_path.clone();
    let library_path = row.path.clone();

    tokio::spawn(async move {
        match scanner::scan_library(id, &library_path, &pool, &thumbs_path).await {
            Ok(result) => tracing::info!(
                library_id = %id,
                added = result.added,
                skipped = result.skipped,
                "scan complete"
            ),
            Err(e) => tracing::error!(library_id = %id, error = %e, "scan failed"),
        }
    });

    Ok(StatusCode::ACCEPTED)
}
