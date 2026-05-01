use crate::{auth::middleware::AuthUser, error::AppError, models::Annotation, AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/books/:id/annotations", get(list_annotations).post(create_annotation))
        .route("/api/books/:id/annotations/export", get(export_annotations))
        .route("/api/annotations/:id", patch(update_annotation).delete(del_annotation))
}

#[derive(Deserialize)]
struct CreateAnnotationRequest {
    kind: String,
    color: Option<String>,
    page: Option<i32>,
    cfi_range: Option<String>,
    position: Option<serde_json::Value>,
    text_content: Option<String>,
    note: Option<String>,
}

#[derive(Deserialize)]
struct UpdateAnnotationRequest {
    note: Option<String>,
}

#[derive(Deserialize)]
struct ExportQuery {
    format: Option<String>,
}

async fn list_annotations(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
) -> Result<Json<Vec<Annotation>>, AppError> {
    let rows = sqlx::query_as!(
        Annotation,
        r#"SELECT id, book_id, user_id, kind, color, page, cfi_range,
                  position as "position: serde_json::Value",
                  text_content, note, created_at
           FROM annotations
           WHERE book_id = $1 AND user_id = $2
           ORDER BY page ASC NULLS LAST, created_at ASC"#,
        book_id,
        auth.user_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn create_annotation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
    Json(payload): Json<CreateAnnotationRequest>,
) -> Result<(StatusCode, Json<Annotation>), AppError> {
    let row = sqlx::query_as!(
        Annotation,
        r#"INSERT INTO annotations
             (book_id, user_id, kind, color, page, cfi_range, position, text_content, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, book_id, user_id, kind, color, page, cfi_range,
                     position as "position: serde_json::Value",
                     text_content, note, created_at"#,
        book_id,
        auth.user_id,
        payload.kind,
        payload.color,
        payload.page,
        payload.cfi_range,
        payload.position,
        payload.text_content,
        payload.note,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn update_annotation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAnnotationRequest>,
) -> Result<Json<Annotation>, AppError> {
    let row = sqlx::query_as!(
        Annotation,
        r#"UPDATE annotations SET note = $1
           WHERE id = $2 AND user_id = $3
           RETURNING id, book_id, user_id, kind, color, page, cfi_range,
                     position as "position: serde_json::Value",
                     text_content, note, created_at"#,
        payload.note,
        id,
        auth.user_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

async fn del_annotation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let row = sqlx::query!(
        "SELECT user_id FROM annotations WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if row.user_id != auth.user_id && !auth.is_admin() {
        return Err(AppError::Forbidden);
    }

    sqlx::query!("DELETE FROM annotations WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn export_annotations(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(book_id): Path<Uuid>,
    Query(q): Query<ExportQuery>,
) -> Result<impl IntoResponse, AppError> {
    let book = sqlx::query!("SELECT title FROM books WHERE id = $1", book_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let rows = sqlx::query_as!(
        Annotation,
        r#"SELECT id, book_id, user_id, kind, color, page, cfi_range,
                  position as "position: serde_json::Value",
                  text_content, note, created_at
           FROM annotations
           WHERE book_id = $1 AND user_id = $2
           ORDER BY page ASC NULLS LAST, created_at ASC"#,
        book_id,
        auth.user_id,
    )
    .fetch_all(&state.pool)
    .await?;

    let format = q.format.as_deref().unwrap_or("json");
    match format {
        "md" => {
            let md = render_markdown(&book.title, &rows);
            let filename = format!("{}_annotations.md", sanitize(&book.title));
            Ok((
                [
                    (header::CONTENT_TYPE, "text/markdown; charset=utf-8"),
                    (header::CONTENT_DISPOSITION, &format!("attachment; filename=\"{filename}\"")),
                ],
                md,
            ).into_response())
        }
        _ => {
            let json = serde_json::to_string_pretty(&rows)
                .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
            let filename = format!("{}_annotations.json", sanitize(&book.title));
            Ok((
                [
                    (header::CONTENT_TYPE, "application/json"),
                    (header::CONTENT_DISPOSITION, &format!("attachment; filename=\"{filename}\"")),
                ],
                json,
            ).into_response())
        }
    }
}

fn render_markdown(title: &str, annotations: &[Annotation]) -> String {
    let mut out = format!("# {title}\n\n");
    for ann in annotations {
        let loc = match (&ann.page, &ann.cfi_range) {
            (Some(p), _) => format!("p.{p}"),
            (_, Some(c)) => format!("CFI: {c}"),
            _ => "unknown".to_string(),
        };
        let color = ann.color.as_deref().unwrap_or("yellow");
        out.push_str(&format!("### {loc} ({color})\n"));
        if let Some(text) = &ann.text_content {
            out.push_str(&format!("> {text}\n"));
        }
        if let Some(note) = &ann.note {
            if !note.is_empty() {
                out.push_str(&format!("\n노트: {note}\n"));
            }
        }
        out.push('\n');
    }
    out
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
