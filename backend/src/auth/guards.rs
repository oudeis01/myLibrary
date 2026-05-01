use crate::{auth::middleware::AuthUser, error::AppError, AppState};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Requires admin role; returns 403 for non-admins, 401 if unauthenticated.
pub struct AdminUser(pub AuthUser);

#[async_trait]
impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, AppError> {
        let auth = AuthUser::from_request_parts(parts, state).await?;
        if !auth.is_admin() {
            return Err(AppError::Forbidden);
        }
        Ok(AdminUser(auth))
    }
}

pub async fn check_upload_permission(
    pool: &PgPool,
    user_id: Uuid,
    library_id: Uuid,
    is_admin: bool,
) -> Result<(), AppError> {
    if is_admin {
        return Ok(());
    }
    let row = sqlx::query!(
        "SELECT can_upload FROM library_permissions WHERE library_id = $1 AND user_id = $2",
        library_id,
        user_id,
    )
    .fetch_optional(pool)
    .await?;
    match row {
        Some(r) if r.can_upload => Ok(()),
        _ => Err(AppError::Forbidden),
    }
}

pub async fn check_library_access(
    pool: &PgPool,
    user_id: Uuid,
    library_id: Uuid,
    is_admin: bool,
) -> Result<(), AppError> {
    if is_admin {
        return Ok(());
    }
    let row = sqlx::query!(
        "SELECT can_read FROM library_permissions WHERE library_id = $1 AND user_id = $2",
        library_id,
        user_id,
    )
    .fetch_optional(pool)
    .await?;
    match row {
        Some(r) if r.can_read => Ok(()),
        _ => Err(AppError::Forbidden),
    }
}
