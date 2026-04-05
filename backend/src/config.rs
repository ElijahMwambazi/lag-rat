use anyhow::{Context, Result};

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
    pub dns_resolver: String,
    pub public_probe_url: String,
    pub internet_tcp_host: String,
    pub internet_tcp_port: u16,
    pub request_timeout_ms: u64,
    pub arp_table_path: String,
    pub local_subnet_cidr: String,
    pub active_discovery_enabled: bool,
    pub active_discovery_timeout_ms: u64,
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
            dns_resolver: env("DNS_RESOLVER")?,
            public_probe_url: env("PUBLIC_PROBE_URL")?,
            internet_tcp_host: env("INTERNET_TCP_HOST")?,
            internet_tcp_port: env("INTERNET_TCP_PORT")?
                .parse()
                .context("invalid INTERNET_TCP_PORT")?,
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
        })
    }
}

fn env(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("missing env var: {key}"))
}
