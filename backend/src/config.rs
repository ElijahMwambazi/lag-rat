use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct CaptureConfig {
    pub worker_interval_seconds: u64,
    pub execution_enabled: bool,
    pub retention_hours: u64,
    pub max_file_mb: u64,
    pub default_duration_seconds: u64,
    pub min_duration_seconds: u64,
    pub max_duration_seconds: u64,
    pub output_dir: String,
    pub allowed_interfaces: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct TcpProbeTarget {
    pub host: String,
    pub port: u16,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_port: u16,
    pub database_url: String,
    pub router_ip: String,
    pub router_port: u16,
    pub connectivity_interval_seconds: u64,
    pub dns_interval_seconds: u64,
    pub device_interval_seconds: u64,
    pub dns_test_domain: String,
    pub dns_test_domains: Vec<String>,
    pub dns_resolver: String,
    pub public_probe_url: String,
    pub public_probe_urls: Vec<String>,
    pub internet_tcp_host: String,
    pub internet_tcp_port: u16,
    pub internet_tcp_targets: Vec<TcpProbeTarget>,
    pub request_timeout_ms: u64,
    pub arp_table_path: String,
    pub local_subnet_cidr: String,
    pub active_discovery_enabled: bool,
    pub active_discovery_timeout_ms: u64,
    pub wifi_interval_seconds: u64,
    pub wifi_sampling_enabled: bool,
    pub wifi_interface: String,
    pub wifi_location_label: String,
    pub capture: CaptureConfig,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            app_port: env("APP_PORT")?.parse().context("invalid APP_PORT")?,
            database_url: env("DATABASE_URL")?,
            router_ip: env("ROUTER_IP")?,
            router_port: env("ROUTER_PORT")?.parse().context("invalid ROUTER_PORT")?,
            connectivity_interval_seconds: env("CONNECTIVITY_INTERVAL_SECONDS")?
                .parse()
                .context("invalid CONNECTIVITY_INTERVAL_SECONDS")?,
            dns_interval_seconds: env("DNS_INTERVAL_SECONDS")?
                .parse()
                .context("invalid DNS_INTERVAL_SECONDS")?,
            device_interval_seconds: env("DEVICE_INTERVAL_SECONDS")?
                .parse()
                .context("invalid DEVICE_INTERVAL_SECONDS")?,
            dns_test_domain: env("DNS_TEST_DOMAIN")?,
            dns_test_domains: parse_csv_env_with_fallback("DNS_TEST_DOMAINS", "DNS_TEST_DOMAIN")?,
            dns_resolver: env("DNS_RESOLVER")?,
            public_probe_url: env("PUBLIC_PROBE_URL")?,
            public_probe_urls: parse_csv_env_with_fallback(
                "PUBLIC_PROBE_URLS",
                "PUBLIC_PROBE_URL",
            )?,
            internet_tcp_host: env("INTERNET_TCP_HOST")?,
            internet_tcp_port: env("INTERNET_TCP_PORT")?
                .parse()
                .context("invalid INTERNET_TCP_PORT")?,
            internet_tcp_targets: parse_tcp_targets_with_fallback(
                "INTERNET_TCP_TARGETS",
                "INTERNET_TCP_HOST",
                "INTERNET_TCP_PORT",
            )?,
            request_timeout_ms: env("REQUEST_TIMEOUT_MS")?
                .parse()
                .context("invalid REQUEST_TIMEOUT_MS")?,
            arp_table_path: env("ARP_TABLE_PATH")?,
            local_subnet_cidr: env("LOCAL_SUBNET_CIDR")?,
            active_discovery_enabled: env("ACTIVE_DISCOVERY_ENABLED")?
                .parse()
                .context("invalid ACTIVE_DISCOVERY_ENABLED")?,
            active_discovery_timeout_ms: env("ACTIVE_DISCOVERY_TIMEOUT_MS")?
                .parse()
                .context("invalid ACTIVE_DISCOVERY_TIMEOUT_MS")?,
            wifi_interval_seconds: env("WIFI_INTERVAL_SECONDS")?
                .parse()
                .context("invalid WIFI_INTERVAL_SECONDS")?,
            wifi_sampling_enabled: env("WIFI_SAMPLING_ENABLED")?
                .parse()
                .context("invalid WIFI_SAMPLING_ENABLED")?,
            wifi_interface: env("WIFI_INTERFACE")?,
            wifi_location_label: env("WIFI_LOCATION_LABEL")?,
            capture: CaptureConfig {
                worker_interval_seconds: env("CAPTURE_WORKER_INTERVAL_SECONDS")?
                    .parse()
                    .context("invalid CAPTURE_WORKER_INTERVAL_SECONDS")?,
                execution_enabled: env("CAPTURE_EXECUTION_ENABLED")?
                    .parse()
                    .context("invalid CAPTURE_EXECUTION_ENABLED")?,
                retention_hours: env("CAPTURE_RETENTION_HOURS")?
                    .parse()
                    .context("invalid CAPTURE_RETENTION_HOURS")?,
                max_file_mb: env("CAPTURE_MAX_FILE_MB")?
                    .parse()
                    .context("invalid CAPTURE_MAX_FILE_MB")?,
                default_duration_seconds: env("CAPTURE_DEFAULT_DURATION_SECONDS")?
                    .parse()
                    .context("invalid CAPTURE_DEFAULT_DURATION_SECONDS")?,
                min_duration_seconds: env("CAPTURE_MIN_DURATION_SECONDS")?
                    .parse()
                    .context("invalid CAPTURE_MIN_DURATION_SECONDS")?,
                max_duration_seconds: env("CAPTURE_MAX_DURATION_SECONDS")?
                    .parse()
                    .context("invalid CAPTURE_MAX_DURATION_SECONDS")?,
                output_dir: env("CAPTURE_OUTPUT_DIR")?,
                allowed_interfaces: parse_csv_env("CAPTURE_ALLOWED_INTERFACES")?,
            },
        })
    }
}

fn env(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("missing env var: {key}"))
}

fn parse_csv_env(key: &str) -> Result<Vec<String>> {
    let value = env(key)?;

    Ok(value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

fn parse_csv_env_with_fallback(list_key: &str, fallback_key: &str) -> Result<Vec<String>> {
    match std::env::var(list_key) {
        Ok(value) => {
            let items = parse_csv_value(&value);

            if items.is_empty() {
                parse_csv_env(fallback_key)
            } else {
                Ok(items)
            }
        }
        Err(_) => parse_csv_env(fallback_key),
    }
}

fn parse_csv_value(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn parse_tcp_targets_with_fallback(
    list_key: &str,
    fallback_host_key: &str,
    fallback_port_key: &str,
) -> Result<Vec<TcpProbeTarget>> {
    match std::env::var(list_key) {
        Ok(value) => {
            let targets = parse_tcp_targets_value(&value)?;

            if targets.is_empty() {
                parse_fallback_tcp_target(fallback_host_key, fallback_port_key)
            } else {
                Ok(targets)
            }
        }
        Err(_) => parse_fallback_tcp_target(fallback_host_key, fallback_port_key),
    }
}

fn parse_fallback_tcp_target(host_key: &str, port_key: &str) -> Result<Vec<TcpProbeTarget>> {
    Ok(vec![TcpProbeTarget {
        host: env(host_key)?,
        port: env(port_key)?
            .parse()
            .context("invalid INTERNET_TCP_PORT")?,
    }])
}

fn parse_tcp_targets_value(value: &str) -> Result<Vec<TcpProbeTarget>> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(parse_tcp_target)
        .collect()
}

fn parse_tcp_target(value: &str) -> Result<TcpProbeTarget> {
    let (host, port) = value
        .rsplit_once(':')
        .with_context(|| format!("invalid TCP probe target: {value}"))?;

    let host = host.trim();
    let port = port.trim();

    if host.is_empty() {
        anyhow::bail!("TCP probe target host is required");
    }

    Ok(TcpProbeTarget {
        host: host.to_string(),
        port: port
            .parse()
            .with_context(|| format!("invalid TCP probe target port: {value}"))?,
    })
}
