use sqlx::SqlitePool;
use crate::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub db: SqlitePool,
}

impl AppState {
    pub fn new(config: AppConfig, db: SqlitePool) -> Self {
        Self { config, db }
    }
}
