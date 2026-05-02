use crate::{auth::middleware::AuthUser, error::AppError, models::BookSummary, AppState};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/search", get(search))
}

#[derive(Deserialize)]
struct SearchParams {
    q: String,
    #[serde(rename = "type", default = "default_type")]
    kind: SearchKind,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum SearchKind {
    Book,
    Annotation,
}

fn default_type() -> SearchKind {
    SearchKind::Book
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum SearchResult {
    Book(BookSummary),
    Annotation(AnnotationHit),
}

#[derive(Serialize)]
pub struct AnnotationHit {
    pub id: Uuid,
    pub book_id: Uuid,
    pub book_title: String,
    pub page: Option<i32>,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: OffsetDateTime,
}

async fn search(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Vec<SearchResult>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let results = if params.kind == SearchKind::Book {
        search_books(&state, &auth, &params.q, limit, offset).await?
    } else {
        search_annotations(&state, &auth, &params.q, limit, offset).await?
    };

    Ok(Json(results))
}

async fn search_books(
    state: &AppState,
    auth: &AuthUser,
    q: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<SearchResult>, AppError> {
    let books: Vec<BookSummary> = if auth.is_admin() {
        sqlx::query_as!(
            BookSummary,
            r#"SELECT id, library_id, title, authors, format, cover_path, page_count, year, tags, created_at
               FROM books
               WHERE book_search_vector(title, authors, tags)
                     @@ plainto_tsquery('simple'::regconfig, $1)
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3"#,
            q,
            limit,
            offset,
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as!(
            BookSummary,
            r#"SELECT b.id, b.library_id, b.title, b.authors, b.format, b.cover_path,
                      b.page_count, b.year, b.tags, b.created_at
               FROM books b
               WHERE book_search_vector(b.title, b.authors, b.tags)
                     @@ plainto_tsquery('simple'::regconfig, $1)
                 AND EXISTS (
                   SELECT 1 FROM library_permissions lp
                   WHERE lp.library_id = b.library_id
                     AND lp.user_id = $4
                     AND lp.can_read = true
                 )
               ORDER BY b.created_at DESC
               LIMIT $2 OFFSET $3"#,
            q,
            limit,
            offset,
            auth.user_id,
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(books.into_iter().map(SearchResult::Book).collect())
}

async fn search_annotations(
    state: &AppState,
    auth: &AuthUser,
    q: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<SearchResult>, AppError> {
    struct Row {
        id: Uuid,
        book_id: Uuid,
        book_title: String,
        page: Option<i32>,
        text_content: Option<String>,
        note: Option<String>,
        created_at: OffsetDateTime,
    }

    let rows: Vec<Row> = if auth.is_admin() {
        sqlx::query_as!(
            Row,
            r#"SELECT a.id, a.book_id, b.title AS book_title, a.page,
                      a.text_content, a.note, a.created_at
               FROM annotations a
               JOIN books b ON b.id = a.book_id
               WHERE to_tsvector('simple',
                       coalesce(a.text_content,'') || ' ' || coalesce(a.note,''))
                     @@ plainto_tsquery('simple', $1)
               ORDER BY a.created_at DESC
               LIMIT $2 OFFSET $3"#,
            q,
            limit,
            offset,
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as!(
            Row,
            r#"SELECT a.id, a.book_id, b.title AS book_title, a.page,
                      a.text_content, a.note, a.created_at
               FROM annotations a
               JOIN books b ON b.id = a.book_id
               WHERE a.user_id = $4
                 AND to_tsvector('simple',
                       coalesce(a.text_content,'') || ' ' || coalesce(a.note,''))
                     @@ plainto_tsquery('simple', $1)
               ORDER BY a.created_at DESC
               LIMIT $2 OFFSET $3"#,
            q,
            limit,
            offset,
            auth.user_id,
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(rows
        .into_iter()
        .map(|r| {
            SearchResult::Annotation(AnnotationHit {
                id: r.id,
                book_id: r.book_id,
                book_title: r.book_title,
                page: r.page,
                text_content: r.text_content,
                note: r.note,
                created_at: r.created_at,
            })
        })
        .collect())
}
