use crate::{auth::middleware::AuthUser, error::AppError, models::Bookmark, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/books/:id/bookmarks", get(list_bookmarks).post(create_bookmark))
        .route("/api/bookmarks/:id", delete(del_bookmark))
}

#[derive(Deserialize)]
struct CreateBookmarkRequest {
    page: i32,
    label: Option<String>,
}

async fn list_bookmarks(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
) -> Result<Json<Vec<Bookmark>>, AppError> {
    let rows = sqlx::query_as!(
        Bookmark,
        "SELECT id, book_id, user_id, page, label, created_at
         FROM bookmarks
         WHERE book_id = $1 AND user_id = $2
         ORDER BY page ASC",
        book_id,
        auth.user_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn create_bookmark(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
    Json(payload): Json<CreateBookmarkRequest>,
) -> Result<(StatusCode, Json<Bookmark>), AppError> {
    let row = sqlx::query_as!(
        Bookmark,
        "INSERT INTO bookmarks (book_id, user_id, page, label)
         VALUES ($1, $2, $3, $4)
         RETURNING id, book_id, user_id, page, label, created_at",
        book_id,
        auth.user_id,
        payload.page,
        payload.label,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn del_bookmark(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        "DELETE FROM bookmarks WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id,
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
