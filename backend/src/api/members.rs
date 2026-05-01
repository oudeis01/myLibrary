use crate::{auth::guards::AdminUser, error::AppError, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/libraries/:id/members",
            get(list_members).post(add_member),
        )
        .route(
            "/api/libraries/:id/members/:uid",
            axum::routing::patch(update_member).delete(remove_member),
        )
}

#[derive(Serialize)]
struct MemberResponse {
    user_id: Uuid,
    username: String,
    can_read: bool,
    can_upload: bool,
}

#[derive(Deserialize)]
struct AddMemberRequest {
    user_id: Uuid,
    can_read: Option<bool>,
    can_upload: Option<bool>,
}

#[derive(Deserialize)]
struct UpdateMemberRequest {
    can_read: Option<bool>,
    can_upload: Option<bool>,
}

async fn list_members(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path(library_id): Path<Uuid>,
) -> Result<Json<Vec<MemberResponse>>, AppError> {
    let rows = sqlx::query!(
        r#"SELECT lp.user_id, u.username, lp.can_read, lp.can_upload
           FROM library_permissions lp
           JOIN users u ON u.id = lp.user_id
           WHERE lp.library_id = $1
           ORDER BY u.username"#,
        library_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| MemberResponse {
                user_id: r.user_id,
                username: r.username,
                can_read: r.can_read,
                can_upload: r.can_upload,
            })
            .collect(),
    ))
}

async fn add_member(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path(library_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<(StatusCode, Json<MemberResponse>), AppError> {
    let can_read = payload.can_read.unwrap_or(true);
    let can_upload = payload.can_upload.unwrap_or(false);

    let row = sqlx::query!(
        r#"WITH upsert AS (
             INSERT INTO library_permissions (library_id, user_id, can_read, can_upload)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (library_id, user_id) DO UPDATE
               SET can_read = EXCLUDED.can_read, can_upload = EXCLUDED.can_upload
             RETURNING user_id, can_read, can_upload
           )
           SELECT u.username, upsert.can_read, upsert.can_upload
           FROM upsert
           JOIN users u ON u.id = upsert.user_id"#,
        library_id,
        payload.user_id,
        can_read,
        can_upload,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok((
        StatusCode::CREATED,
        Json(MemberResponse {
            user_id: payload.user_id,
            username: row.username,
            can_read: row.can_read,
            can_upload: row.can_upload,
        }),
    ))
}

async fn update_member(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path((library_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRequest>,
) -> Result<Json<MemberResponse>, AppError> {
    let row = sqlx::query!(
        r#"WITH upd AS (
             UPDATE library_permissions SET
               can_read = COALESCE($1, can_read),
               can_upload = COALESCE($2, can_upload)
             WHERE library_id = $3 AND user_id = $4
             RETURNING user_id, can_read, can_upload
           )
           SELECT u.username, upd.can_read, upd.can_upload
           FROM upd
           JOIN users u ON u.id = upd.user_id"#,
        payload.can_read,
        payload.can_upload,
        library_id,
        user_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(MemberResponse {
        user_id,
        username: row.username,
        can_read: row.can_read,
        can_upload: row.can_upload,
    }))
}

async fn remove_member(
    _admin: AdminUser,
    State(state): State<AppState>,
    Path((library_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        "DELETE FROM library_permissions WHERE library_id = $1 AND user_id = $2",
        library_id,
        user_id,
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
