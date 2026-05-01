pub mod guards;
pub mod middleware;

use jsonwebtoken::{encode, EncodingKey, Header};
use middleware::Claims;
use time::OffsetDateTime;
use uuid::Uuid;

pub fn make_access_token(user_id: Uuid, role: &str, secret: &str) -> anyhow::Result<String> {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now,
        exp: now + 15 * 60, // 15 minutes
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(Into::into)
}

pub fn make_refresh_token() -> String {
    Uuid::new_v4().to_string()
}
