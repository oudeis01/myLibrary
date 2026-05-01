mod api;
mod auth;
mod config;
mod db;
mod error;
mod models;
mod services;

use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub jwt_secret: String,
    pub books_path: String,
    pub thumbs_path: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ebook_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("connected to database");

    sqlx::migrate!("../migrations").run(&pool).await?;
    tracing::info!("migrations applied");

    seed_admin(&pool).await?;

    let state = AppState {
        pool,
        jwt_secret: config.jwt_secret,
        books_path: config.books_path,
        thumbs_path: config.thumbs_path,
    };

    let app = api::router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    tracing::info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn seed_admin(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    let (Ok(username), Ok(password)) = (
        std::env::var("ADMIN_USERNAME"),
        std::env::var("ADMIN_PASSWORD"),
    ) else {
        return Ok(());
    };

    let count: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?
        .unwrap_or(0);

    if count == 0 {
        let hash = api::users::hash_password(&password)
            .map_err(|e| anyhow::anyhow!("{e:?}"))?;
        sqlx::query!(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')",
            username,
            hash,
        )
        .execute(pool)
        .await?;
        tracing::info!("created initial admin user: {}", username);
    }

    Ok(())
}
