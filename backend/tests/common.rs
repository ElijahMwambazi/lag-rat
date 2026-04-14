use std::sync::Mutex;
use std::{env, fs, path::PathBuf, str::FromStr};

use lag_rat_backend::{config::AppConfig, db, state::AppState};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tempfile::TempDir;

#[allow(dead_code)]
pub struct TestHarness {
    pub _tmpdir: TempDir,
    pub root: PathBuf,
    pub state: AppState,
}

static TEST_ENV_LOCK: Mutex<()> = Mutex::new(());

impl TestHarness {
    pub async fn new() -> anyhow::Result<Self> {
        let _guard = TEST_ENV_LOCK.lock().unwrap();

        let tmpdir = tempfile::tempdir()?;
        let root = tmpdir.path().to_path_buf();
        let backend_dir = root.join("backend");
        let migrations_dir = backend_dir.join("migrations");
        fs::create_dir_all(&migrations_dir)?;

        for file in [
            "0001_initial.sql",
            "0002_outages.sql",
            "0003_alerts_and_known_devices.sql",
            "0004_multi_probe.sql",
            "0005_device_history.sql",
            "0006_alert_acknowledgement.sql",
            "0007_alert_history.sql",
            "0008_wifi_sample.sql",
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
            local_subnet_cidr: "192.168.1.0/24".to_string(),
            active_discovery_enabled: false,
            active_discovery_timeout_ms: 200,
            dns_test_domain: "google.com".to_string(),
            dns_resolver: "1.1.1.1".to_string(),
            public_probe_url: "https://www.google.com/generate_204".to_string(),
            request_timeout_ms: 3000,
            arp_table_path: "/proc/net/arp".to_string(),
            internet_tcp_host: "1.1.1.1".to_string(),
            internet_tcp_port: 443,
            wifi_interval_seconds: 60,
            wifi_sampling_enabled: false,
            wifi_interface: "wlan0".to_string(),
            wifi_location_label: "office".to_string(),
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
