//! Permission tests P-01 to P-12.
//! Requires DATABASE_URL pointing to a PostgreSQL instance where the user has CREATEDB privilege.
//! Grant with: ALTER USER ebook CREATEDB;
use super::helpers::*;
use crate::api;
use axum::http::header::AUTHORIZATION;
use axum_test::TestServer;
use sqlx::PgPool;

fn server(pool: PgPool) -> TestServer {
    TestServer::new(api::router(test_state(pool))).expect("test server")
}

fn auth(token: &str) -> axum::http::HeaderValue {
    format!("Bearer {token}").parse().unwrap()
}

/// P-01: Member cannot delete a book (403)
#[sqlx::test(migrations = "../migrations")]
async fn p01_member_cannot_delete_book(pool: PgPool) {
    let lib_id = create_library(&pool, "lib1").await;
    let book_id = create_book(&pool, lib_id, "Book A").await;
    let (member_id, token) = create_user(&pool, "member1", "member").await;
    grant_permission(&pool, lib_id, member_id, true, false).await;

    let resp = server(pool)
        .delete(&format!("/api/books/{book_id}"))
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

/// P-02: Admin can delete a book (204)
#[sqlx::test(migrations = "../migrations")]
async fn p02_admin_can_delete_book(pool: PgPool) {
    let lib_id = create_library(&pool, "lib2").await;
    let book_id = create_book(&pool, lib_id, "Book B").await;
    let (_admin_id, token) = create_user(&pool, "admin1", "admin").await;

    let resp = server(pool)
        .delete(&format!("/api/books/{book_id}"))
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::NO_CONTENT);
}

/// P-03: Member without upload permission cannot upload (403).
/// Send a minimal multipart body so the Multipart extractor succeeds and we reach the
/// permission check in the handler body.
#[sqlx::test(migrations = "../migrations")]
async fn p03_member_no_upload_permission(pool: PgPool) {
    let lib_id = create_library(&pool, "lib3").await;
    let (member_id, token) = create_user(&pool, "member3", "member").await;
    grant_permission(&pool, lib_id, member_id, true, false).await;

    let boundary = "TESTBOUNDARY";
    let body = format!("--{boundary}\r\nContent-Disposition: form-data; name=\"dummy\"\r\n\r\nval\r\n--{boundary}--\r\n");

    let resp = server(pool)
        .post(&format!("/api/libraries/{lib_id}/upload"))
        .add_header(AUTHORIZATION, auth(&token))
        .content_type(&format!("multipart/form-data; boundary={boundary}"))
        .bytes(body.into_bytes().into())
        .await;

    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

/// P-04: Member with upload permission passes auth check (not 403).
#[sqlx::test(migrations = "../migrations")]
async fn p04_member_with_upload_permission_passes_auth(pool: PgPool) {
    let lib_id = create_library(&pool, "lib4").await;
    let (member_id, token) = create_user(&pool, "member4", "member").await;
    grant_permission(&pool, lib_id, member_id, true, true).await;

    let boundary = "TESTBOUNDARY";
    let body = format!("--{boundary}\r\nContent-Disposition: form-data; name=\"dummy\"\r\n\r\nval\r\n--{boundary}--\r\n");

    let resp = server(pool)
        .post(&format!("/api/libraries/{lib_id}/upload"))
        .add_header(AUTHORIZATION, auth(&token))
        .content_type(&format!("multipart/form-data; boundary={boundary}"))
        .bytes(body.into_bytes().into())
        .await;

    // Permission check passes; fails on missing file field (400), not auth (403)
    assert_ne!(resp.status_code(), axum::http::StatusCode::FORBIDDEN);
}

/// P-05: Member cannot delete another user's annotation (403)
#[sqlx::test(migrations = "../migrations")]
async fn p05_member_cannot_delete_others_annotation(pool: PgPool) {
    let lib_id = create_library(&pool, "lib5").await;
    let book_id = create_book(&pool, lib_id, "Book C").await;
    let (owner_id, _) = create_user(&pool, "owner5", "member").await;
    let (member_id, token) = create_user(&pool, "member5", "member").await;
    grant_permission(&pool, lib_id, member_id, true, false).await;
    let annotation_id = create_annotation(&pool, book_id, owner_id).await;

    let resp = server(pool)
        .delete(&format!("/api/annotations/{annotation_id}"))
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

/// P-06: Admin can delete any annotation (204)
#[sqlx::test(migrations = "../migrations")]
async fn p06_admin_can_delete_any_annotation(pool: PgPool) {
    let lib_id = create_library(&pool, "lib6").await;
    let book_id = create_book(&pool, lib_id, "Book D").await;
    let (owner_id, _) = create_user(&pool, "owner6", "member").await;
    let (_admin_id, token) = create_user(&pool, "admin6", "admin").await;
    let annotation_id = create_annotation(&pool, book_id, owner_id).await;

    let resp = server(pool)
        .delete(&format!("/api/annotations/{annotation_id}"))
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::NO_CONTENT);
}

/// P-07: Unauthenticated user cannot list books (401)
#[sqlx::test(migrations = "../migrations")]
async fn p07_unauthenticated_cannot_list_books(pool: PgPool) {
    let resp = server(pool).get("/api/books").await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

/// P-08: Member without read permission sees empty book list (membership filter).
/// Querying all books (no library_id filter) returns only books from permitted libraries,
/// so a member with no permissions gets an empty list.
#[sqlx::test(migrations = "../migrations")]
async fn p08_member_no_read_permission_gets_empty_list(pool: PgPool) {
    let lib_id = create_library(&pool, "lib8").await;
    create_book(&pool, lib_id, "Hidden Book").await;
    let (_member_id, token) = create_user(&pool, "member8", "member").await;

    let resp = server(pool)
        .get("/api/books")
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status_ok();
    let books: Vec<serde_json::Value> = resp.json();
    assert!(books.is_empty(), "member without permission should see no books");
}

/// P-09: Member with read permission can see books (membership filter)
#[sqlx::test(migrations = "../migrations")]
async fn p09_member_with_read_permission_sees_books(pool: PgPool) {
    let lib_id = create_library(&pool, "lib9").await;
    create_book(&pool, lib_id, "Visible Book").await;
    let (member_id, token) = create_user(&pool, "member9", "member").await;
    grant_permission(&pool, lib_id, member_id, true, false).await;

    let resp = server(pool)
        .get("/api/books")
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status_ok();
    let books: Vec<serde_json::Value> = resp.json();
    assert_eq!(books.len(), 1);
}

/// P-10: Admin sees all books across libraries
#[sqlx::test(migrations = "../migrations")]
async fn p10_admin_sees_all_books(pool: PgPool) {
    let lib1 = create_library(&pool, "lib10a").await;
    let lib2 = create_library(&pool, "lib10b").await;
    create_book(&pool, lib1, "Book in Lib1").await;
    create_book(&pool, lib2, "Book in Lib2").await;
    let (_admin_id, token) = create_user(&pool, "admin10", "admin").await;

    let resp = server(pool)
        .get("/api/books")
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status_ok();
    let books: Vec<serde_json::Value> = resp.json();
    assert_eq!(books.len(), 2);
}

/// P-11: Member cannot list users (403)
#[sqlx::test(migrations = "../migrations")]
async fn p11_member_cannot_list_users(pool: PgPool) {
    let (_member_id, token) = create_user(&pool, "member11", "member").await;

    let resp = server(pool)
        .get("/api/users")
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

/// P-12: Admin can delete a user (204)
#[sqlx::test(migrations = "../migrations")]
async fn p12_admin_can_delete_user(pool: PgPool) {
    let (target_id, _) = create_user(&pool, "target12", "member").await;
    let (_admin_id, token) = create_user(&pool, "admin12", "admin").await;

    let resp = server(pool)
        .delete(&format!("/api/users/{target_id}"))
        .add_header(AUTHORIZATION, auth(&token))
        .await;

    resp.assert_status(axum::http::StatusCode::NO_CONTENT);
}
