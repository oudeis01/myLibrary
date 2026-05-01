use crate::{auth::middleware::AuthUser, error::AppError, models::ReadingProgress, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/progress/:book_id",
            get(get_progress).put(upsert_progress),
        )
}

#[derive(Deserialize)]
struct ProgressUpdate {
    page: i32,
    cfi: Option<String>,
    percent: f64,
}

async fn get_progress(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
) -> Result<Json<ReadingProgress>, AppError> {
    let progress = sqlx::query_as!(
        ReadingProgress,
        "SELECT user_id, book_id, page, cfi, percent, updated_at
         FROM reading_progress WHERE user_id = $1 AND book_id = $2",
        auth.user_id,
        book_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(progress))
}

async fn upsert_progress(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
    Json(payload): Json<ProgressUpdate>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        r#"INSERT INTO reading_progress (user_id, book_id, page, cfi, percent, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id, book_id) DO UPDATE SET
             page = EXCLUDED.page,
             cfi = EXCLUDED.cfi,
             percent = EXCLUDED.percent,
             updated_at = NOW()"#,
        auth.user_id,
        book_id,
        payload.page,
        payload.cfi,
        payload.percent,
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
