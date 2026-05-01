use crate::{auth::middleware::AuthUser, error::AppError, models::BookSummary, AppState};
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/books", get(list_books))
        .route("/api/books/:id", get(get_book))
        .route("/api/books/:id/download", get(download_book))
}

#[derive(Deserialize)]
struct BooksQuery {
    library_id: Option<Uuid>,
    format: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_books(
    _auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<BooksQuery>,
) -> Result<Json<Vec<BookSummary>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query!(
        r#"SELECT id, library_id, title, authors, format, cover_path, page_count, year, created_at
           FROM books
           WHERE ($1::uuid IS NULL OR library_id = $1)
             AND ($2::text IS NULL OR format = $2)
             AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%')
           ORDER BY created_at DESC
           LIMIT $4 OFFSET $5"#,
        params.library_id as Option<Uuid>,
        params.format,
        params.q,
        limit,
        offset,
    )
    .fetch_all(&state.pool)
    .await?;

    let books = rows
        .into_iter()
        .map(|r| BookSummary {
            id: r.id,
            library_id: r.library_id,
            title: r.title,
            authors: r.authors,
            format: r.format,
            cover_path: r.cover_path,
            page_count: r.page_count,
            year: r.year,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(books))
}

async fn get_book(
    _auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::models::Book>, AppError> {
    let book = sqlx::query_as!(
        crate::models::Book,
        r#"SELECT id, library_id, title, authors, format, file_path, file_size,
                  page_count, cover_path, description, year, language, tags, metadata,
                  created_at, updated_at
           FROM books WHERE id = $1"#,
        id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(book))
}

async fn download_book(
    _auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    use axum::http::Request;
    use tower::util::ServiceExt;
    use tower_http::services::ServeFile;

    let row = sqlx::query!("SELECT file_path, format FROM books WHERE id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let serve = ServeFile::new(&row.file_path);
    let req = Request::new(axum::body::Body::empty());
    serve
        .oneshot(req)
        .await
        .map_err(|_: std::convert::Infallible| AppError::NotFound)
}
