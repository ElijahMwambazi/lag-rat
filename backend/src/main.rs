mod api;
mod config;
mod db;
mod models;
mod monitors;
mod scheduler;
mod state;

use std::{net::SocketAddr, str::FromStr};

use anyhow::Context;
use axum::Router;
use config::AppConfig;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use state::AppState;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = AppConfig::from_env()?;

    let connect_options = SqliteConnectOptions::from_str(&config.database_url)?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await
        .with_context(|| format!("failed to connect to database: {}", config.database_url))?;

    db::run_migrations(&pool).await?;

    let state = AppState::new(config.clone(), pool);

    let monitor_state = state.clone();
    tokio::spawn(async move {
        scheduler::start(monitor_state).await;
    });

    let app = build_router(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], config.app_port));
    info!("lag-rat backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn build_router(state: AppState) -> Router {
    api::router(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "lag_rat_backend=debug,axum=info,tower_http=info".to_string()),
        )
        .init();
}
