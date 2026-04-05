use std::{env, fs, path::PathBuf, str::FromStr};

use lag_rat_backend::{config::AppConfig, db, state::AppState};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tempfile::TempDir;

pub struct TestHarness {
    pub _tmpdir: TempDir,
    pub root: PathBuf,
    pub state: AppState,
}

impl TestHarness {
    pub async fn new() -> anyhow::Result<Self> {
        let tmpdir = tempfile::tempdir()?;
        let root = tmpdir.path().to_path_buf();
        let backend_dir = root.join("backend");
        let migrations_dir = backend_dir.join("migrations");
        fs::create_dir_all(&migrations_dir)?;

        for file in [
            "0001_initial.sql",
            "0002_outages.sql",
            "0003_alerts_and_known_devices.sql",
        ] {
            fs::copy(
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("migrations")
                    .join(file),
                migrations_dir.join(file),
            )?;
        }

        let db_path = backend_dir.join("test.db");
        let db_url = format!("sqlite://{}", db_path.display());
        let opts = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await?;

        let old_dir = env::current_dir()?;
        env::set_current_dir(&backend_dir)?;
        db::run_migrations(&pool).await?;
        env::set_current_dir(old_dir)?;

        let config = AppConfig {
            app_port: 8080,
            database_url: db_url,
            router_ip: "192.168.1.1".to_string(),
            router_port: 80,
            connectivity_interval_seconds: 30,
            dns_interval_seconds: 60,
            device_interval_seconds: 120,
            dns_test_domain: "example.com".to_string(),
            dns_resolver: "1.1.1.1".to_string(),
            public_probe_url: "https://example.com".to_string(),
            request_timeout_ms: 3000,
            arp_table_path: "/proc/net/arp".to_string(),
        };

        db::seed_default_known_devices(&pool, &config.router_ip).await?;

        let state = AppState::new(config.clone(), pool);

        Ok(Self {
            _tmpdir: tmpdir,
            root,
            state,
        })
    }
}
