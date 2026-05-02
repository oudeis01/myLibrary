use crate::{auth::make_access_token, AppState};
use sqlx::PgPool;
use uuid::Uuid;

pub const TEST_JWT_SECRET: &str = "test-secret-key-for-tests";

/// Creates AppState suitable for testing (no real file paths needed for permission tests).
pub fn test_state(pool: PgPool) -> AppState {
    AppState {
        pool,
        jwt_secret: TEST_JWT_SECRET.to_string(),
        books_path: "/tmp/test-books".to_string(),
        thumbs_path: "/tmp/test-thumbs".to_string(),
    }
}

/// Creates a user with the given role and returns (user_id, bearer_token).
pub async fn create_user(pool: &PgPool, username: &str, role: &str) -> (Uuid, String) {
    let id = Uuid::new_v4();
    // argon2 hash of "test-password" — we only need this to satisfy NOT NULL
    let hash = "$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0LXRlc3Q$fake-hash-for-tests";
    sqlx::query!(
        "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
        id,
        username,
        hash,
        role,
    )
    .execute(pool)
    .await
    .expect("insert user");

    let token = make_access_token(id, role, TEST_JWT_SECRET).expect("make token");
    (id, token)
}

/// Creates a library and returns its id.
pub async fn create_library(pool: &PgPool, name: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query!(
        "INSERT INTO libraries (id, name, path) VALUES ($1, $2, $3)",
        id,
        name,
        format!("/tmp/test-lib-{id}"),
    )
    .execute(pool)
    .await
    .expect("insert library");
    id
}

/// Creates a book and returns its id.
pub async fn create_book(pool: &PgPool, library_id: Uuid, title: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query!(
        r#"INSERT INTO books (id, library_id, title, authors, format, file_path, tags)
           VALUES ($1, $2, $3, $4, 'pdf', $5, $6)"#,
        id,
        library_id,
        title,
        &[] as &[String],
        format!("/tmp/test-{id}.pdf"),
        &[] as &[String],
    )
    .execute(pool)
    .await
    .expect("insert book");
    id
}

/// Grants library permission to a user.
pub async fn grant_permission(
    pool: &PgPool,
    library_id: Uuid,
    user_id: Uuid,
    can_read: bool,
    can_upload: bool,
) {
    sqlx::query!(
        r#"INSERT INTO library_permissions (library_id, user_id, can_read, can_upload)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (library_id, user_id) DO UPDATE
             SET can_read = $3, can_upload = $4"#,
        library_id,
        user_id,
        can_read,
        can_upload,
    )
    .execute(pool)
    .await
    .expect("insert permission");
}

/// Creates an annotation for a book and returns its id.
pub async fn create_annotation(pool: &PgPool, book_id: Uuid, user_id: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query!(
        r#"INSERT INTO annotations (id, book_id, user_id, kind, color, text_content)
           VALUES ($1, $2, $3, 'highlight', 'yellow', 'test content')"#,
        id,
        book_id,
        user_id,
    )
    .execute(pool)
    .await
    .expect("insert annotation");
    id
}
