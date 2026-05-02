use crate::{
    auth::guards::{check_library_access, check_upload_permission, AdminUser},
    auth::middleware::AuthUser,
    error::AppError,
    models::{Book, BookSummary},
    services::{
        format_detector::{detect_format, BookFormat},
        scanner,
    },
    AppState,
};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::{fs, path::Path as StdPath};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/books", get(list_books))
        .route("/api/books/:id", get(get_book).patch(update_book).delete(delete_book))
        .route("/api/books/:id/download", get(download_book))
        .route("/api/libraries/:id/upload", post(upload_book))
}

#[derive(Deserialize)]
struct BooksQuery {
    library_id: Option<Uuid>,
    format: Option<String>,
    q: Option<String>,
    tag: Option<String>,
    year: Option<i32>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Deserialize)]
struct UpdateBookRequest {
    title: Option<String>,
    authors: Option<Vec<String>>,
    description: Option<String>,
    year: Option<i32>,
    language: Option<String>,
    tags: Option<Vec<String>>,
}

async fn list_books(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<BooksQuery>,
) -> Result<Json<Vec<BookSummary>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    if let Some(lib_id) = params.library_id {
        check_library_access(&state.pool, auth.user_id, lib_id, auth.is_admin()).await?;
    }

    let books: Vec<BookSummary> = if auth.is_admin() {
        sqlx::query_as!(
            BookSummary,
            r#"SELECT id, library_id, title, authors, format, cover_path, page_count, year, tags, created_at
               FROM books
               WHERE ($1::uuid IS NULL OR library_id = $1)
                 AND ($2::text IS NULL OR format = $2)
                 AND ($3::text IS NULL OR
                      book_search_vector(title, authors, tags)
                      @@ plainto_tsquery('simple'::regconfig, $3))
                 AND ($6::text IS NULL OR $6 = ANY(tags))
                 AND ($7::integer IS NULL OR year = $7)
               ORDER BY created_at DESC
               LIMIT $4 OFFSET $5"#,
            params.library_id as Option<Uuid>,
            params.format,
            params.q,
            limit,
            offset,
            params.tag,
            params.year,
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as!(
            BookSummary,
            r#"SELECT b.id, b.library_id, b.title, b.authors, b.format, b.cover_path,
                      b.page_count, b.year, b.tags, b.created_at
               FROM books b
               WHERE ($1::uuid IS NULL OR b.library_id = $1)
                 AND ($2::text IS NULL OR b.format = $2)
                 AND ($3::text IS NULL OR
                      to_tsvector('simple', b.title || ' ' || array_to_string(b.authors, ' ') || ' ' || array_to_string(b.tags, ' '))
                      @@ plainto_tsquery('simple', $3))
                 AND ($7::text IS NULL OR $7 = ANY(b.tags))
                 AND ($8::integer IS NULL OR b.year = $8)
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
            params.tag,
            params.year,
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(books))
}

async fn get_book(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Book>, AppError> {
    let book = sqlx::query_as!(
        Book,
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

async fn update_book(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBookRequest>,
) -> Result<Json<Book>, AppError> {
    let book = sqlx::query_as!(
        Book,
        r#"SELECT id, library_id, title, authors, format, file_path, file_size,
                  page_count, cover_path, description, year, language, tags, metadata,
                  created_at, updated_at
           FROM books WHERE id = $1"#,
        id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    check_upload_permission(&state.pool, auth.user_id, book.library_id, auth.is_admin()).await?;

    let updated = sqlx::query_as!(
        Book,
        r#"UPDATE books SET
             title = COALESCE($1, title),
             authors = COALESCE($2, authors),
             description = COALESCE($3, description),
             year = COALESCE($4, year),
             language = COALESCE($5, language),
             tags = COALESCE($6, tags),
             updated_at = NOW()
           WHERE id = $7
           RETURNING id, library_id, title, authors, format, file_path, file_size,
                     page_count, cover_path, description, year, language, tags, metadata,
                     created_at, updated_at"#,
        payload.title,
        payload.authors.as_deref(),
        payload.description,
        payload.year,
        payload.language,
        payload.tags.as_deref(),
        id,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated))
}

async fn upload_book(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(library_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<BookSummary>), AppError> {
    check_upload_permission(&state.pool, auth.user_id, library_id, auth.is_admin()).await?;

    let library_path = sqlx::query_scalar!("SELECT path FROM libraries WHERE id = $1", library_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name = String::new();
    let mut title_override: Option<String> = None;
    let mut authors_override: Option<Vec<String>> = None;
    let mut year_override: Option<i32> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        match field.name().unwrap_or("") {
            "file" => {
                file_name = field
                    .file_name()
                    .unwrap_or("upload")
                    .to_string();
                file_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| AppError::BadRequest(e.to_string()))?
                        .to_vec(),
                );
            }
            "title" => {
                let s = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !s.is_empty() {
                    title_override = Some(s);
                }
            }
            "authors" => {
                let s = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !s.is_empty() {
                    authors_override = Some(s.split(',').map(|a| a.trim().to_string()).collect());
                }
            }
            "year" => {
                let s = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                year_override = s.trim().parse::<i32>().ok();
            }
            _ => {
                // consume and ignore unknown fields
                let _ = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| AppError::BadRequest("missing file field".into()))?;

    let ext = StdPath::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !["pdf", "epub", "cbz"].contains(&ext.as_str()) {
        return Err(AppError::BadRequest(format!(
            "unsupported format: {ext}; expected pdf, epub, or cbz"
        )));
    }

    fs::create_dir_all(&library_path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("cannot create library dir: {e}")))?;

    let file_id = Uuid::new_v4();
    let dest_name = format!("{file_id}.{ext}");
    let dest_path = StdPath::new(&library_path).join(&dest_name);
    let dest_path_str = dest_path
        .to_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("invalid path")))?
        .to_string();

    fs::write(&dest_path, &file_bytes)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("cannot write file: {e}")))?;

    let file_size = file_bytes.len() as i64;

    let format = detect_format(&dest_path);
    let (meta, cover_path) = match format {
        Some(ref fmt) => {
            let m = scanner::extract_metadata(&dest_path, fmt);
            let c = scanner::save_cover(&dest_path, fmt, &state.thumbs_path).await;
            (m, c)
        }
        None => (Default::default(), None),
    };

    let format_str = match format {
        Some(BookFormat::Pdf) => "pdf",
        Some(BookFormat::Epub) => "epub",
        Some(BookFormat::Cbz) => "cbz",
        None => ext.as_str(),
    }
    .to_string();

    let title = title_override.unwrap_or_else(|| {
        meta.title.unwrap_or_else(|| {
            StdPath::new(&file_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        })
    });
    let authors = authors_override.unwrap_or(meta.authors);
    let year = year_override.or(meta.year);
    let page_count = meta.page_count.map(|p| p as i32);

    let book = sqlx::query_as!(
        BookSummary,
        r#"INSERT INTO books
             (library_id, title, authors, format, file_path, file_size,
              page_count, cover_path, description, year, language, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id, library_id, title, authors, format, cover_path,
                     page_count, year, tags, created_at"#,
        library_id,
        title,
        &authors,
        format_str,
        dest_path_str,
        file_size,
        page_count,
        cover_path,
        meta.description,
        year,
        meta.language,
        serde_json::Value::Object(Default::default()),
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(book)))
}

async fn delete_book(
    AdminUser(_admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let row = sqlx::query!(
        "SELECT file_path, cover_path FROM books WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let _ = fs::remove_file(&row.file_path);
    if let Some(cover) = row.cover_path {
        let _ = fs::remove_file(&cover);
    }

    sqlx::query!("DELETE FROM books WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
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
