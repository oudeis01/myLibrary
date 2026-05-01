use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Library {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Book {
    pub id: Uuid,
    pub library_id: Uuid,
    pub title: String,
    pub authors: Vec<String>,
    pub format: String,
    pub file_path: String,
    pub file_size: Option<i64>,
    pub page_count: Option<i32>,
    pub cover_path: Option<String>,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub language: Option<String>,
    pub tags: Vec<String>,
    pub metadata: serde_json::Value,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReadingProgress {
    pub user_id: Uuid,
    pub book_id: Uuid,
    pub page: i32,
    pub cfi: Option<String>,
    pub percent: f64,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookSummary {
    pub id: Uuid,
    pub library_id: Uuid,
    pub title: String,
    pub authors: Vec<String>,
    pub format: String,
    pub cover_path: Option<String>,
    pub page_count: Option<i32>,
    pub year: Option<i32>,
    pub created_at: OffsetDateTime,
}
