use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub server_port: u16,
    pub books_path: String,
    pub thumbs_path: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL must be set")?,
            jwt_secret: std::env::var("JWT_SECRET")
                .context("JWT_SECRET must be set")?,
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .context("SERVER_PORT must be a valid port number")?,
            books_path: std::env::var("BOOKS_PATH")
                .unwrap_or_else(|_| "./data/books".to_string()),
            thumbs_path: std::env::var("THUMBS_PATH")
                .unwrap_or_else(|_| "./data/thumbs".to_string()),
        })
    }
}
