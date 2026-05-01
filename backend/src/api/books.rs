use crate::{
    auth::guards::check_library_access,
    auth::middleware::AuthUser,
    error::AppError,
    models::BookSummary,
    AppState,
};
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
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<BooksQuery>,
) -> Result<Json<Vec<BookSummary>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    // For a specific library filter, check access upfront
    if let Some(lib_id) = params.library_id {
        check_library_access(&state.pool, auth.user_id, lib_id, auth.is_admin()).await?;
    }

    let books: Vec<BookSummary> = if auth.is_admin() {
        sqlx::query!(
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
        .await?
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
        .collect()
    } else {
        sqlx::query!(
            r#"SELECT b.id, b.library_id, b.title, b.authors, b.format, b.cover_path,
                      b.page_count, b.year, b.created_at
               FROM books b
               WHERE ($1::uuid IS NULL OR b.library_id = $1)
                 AND ($2::text IS NULL OR b.format = $2)
                 AND ($3::text IS NULL OR b.title ILIKE '%' || $3 || '%')
                 AND EXISTS (
                   SELECT 1 FROM library_permissions lp
                   WHERE lp.library_id = b.library_id
                     AND lp.user_id = $6
                     AND lp.can_read = true
                 )
               ORDER BY b.created_at DESC
               LIMIT $4 OFFSET $5"#,
            params.library_id as Option<Uuid>,
            params.format,
            params.q,
            limit,
            offset,
            auth.user_id,
        )
        .fetch_all(&state.pool)
        .await?
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
        .collect()
    };

    Ok(Json(books))
}

async fn get_book(
    auth: AuthUser,
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

    check_library_access(&state.pool, auth.user_id, book.library_id, auth.is_admin()).await?;

    Ok(Json(book))
}

async fn download_book(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    use axum::http::Request;
    use tower::util::ServiceExt;
    use tower_http::services::ServeFile;

    let row = sqlx::query!(
        "SELECT file_path, format, library_id FROM books WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    check_library_access(&state.pool, auth.user_id, row.library_id, auth.is_admin()).await?;

    let serve = ServeFile::new(&row.file_path);
    let req = Request::new(axum::body::Body::empty());
    serve
        .oneshot(req)
        .await
        .map_err(|_: std::convert::Infallible| AppError::NotFound)
}
