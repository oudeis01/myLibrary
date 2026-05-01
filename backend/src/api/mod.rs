use axum::{routing::get, Json, Router};
use serde_json::json;

use crate::AppState;

pub mod annotations;
pub mod auth;
pub mod books;
pub mod bookmarks;
pub mod libraries;
pub mod members;
pub mod progress;
pub mod reader;
pub mod users;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health_handler))
        .merge(auth::router())
        .merge(users::router())
        .merge(libraries::router())
        .merge(members::router())
        .merge(books::router())
        .merge(reader::router())
        .merge(progress::router())
        .merge(annotations::router())
        .merge(bookmarks::router())
        .with_state(state)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}
