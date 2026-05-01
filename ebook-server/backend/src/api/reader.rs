use crate::{auth::middleware::AuthUser, error::AppError, AppState};
use axum::{
    extract::{Path, State},
    http::Request,
    routing::get,
    Router,
};
use tower::util::ServiceExt;
use tower_http::services::ServeFile;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/reader/:id/epub", get(serve_epub))
        .route("/api/reader/:id/cover", get(serve_cover))
}

async fn serve_epub(
    _auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    let row = sqlx::query!("SELECT file_path, format FROM books WHERE id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if row.format != "epub" {
        return Err(AppError::BadRequest("not an EPUB".into()));
    }

    let serve = ServeFile::new(&row.file_path);
    serve
        .oneshot(Request::new(axum::body::Body::empty()))
        .await
        .map_err(|_: std::convert::Infallible| AppError::NotFound)
}
async fn serve_cover(
    _auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    let row = sqlx::query!("SELECT cover_path FROM books WHERE id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let cover = row.cover_path.ok_or(AppError::NotFound)?;

    let serve = ServeFile::new(&cover);
    serve
        .oneshot(Request::new(axum::body::Body::empty()))
        .await
        .map_err(|_| AppError::NotFound)
}
