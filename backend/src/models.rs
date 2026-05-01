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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Annotation {
    pub id: Uuid,
    pub book_id: Uuid,
    pub user_id: Uuid,
    pub kind: String,
    pub color: Option<String>,
    pub page: Option<i32>,
    pub cfi_range: Option<String>,
    pub position: Option<serde_json::Value>,
    pub text_content: Option<String>,
    pub note: Option<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bookmark {
    pub id: Uuid,
    pub book_id: Uuid,
    pub user_id: Uuid,
    pub page: i32,
    pub label: Option<String>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookSummary {
    pub id: Uuid,
    pub library_id: Uuid,
    pub title: String,
    pub authors: Vec<String>,
    pub format: String,
    pub cover_path: Option<String>,
    pub page_count: Option<i32>,
    pub year: Option<i32>,
    pub tags: Vec<String>,
    pub created_at: OffsetDateTime,
}
