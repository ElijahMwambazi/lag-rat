use std::time::{Duration, Instant};

use chrono::Utc;
use tokio::{net::TcpStream, time::timeout};

use crate::{db, services::alerts, state::AppState};

#[derive(Debug, Clone)]
pub struct ProbeResult {
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error_message: Option<String>,
}

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let now = Utc::now();
    let router_target = format!("{}:{}", state.config.router_ip, state.config.router_port);
    let router_probe = tcp_probe(&router_target, state.config.request_timeout_ms).await;

    db::insert_connectivity_check(&state.db, now, &router_target, "router", router_probe.success, router_probe.latency_ms, router_probe.error_message.as_deref()).await?;
    alerts::evaluate_connectivity(state, "router", &router_target, &router_probe).await?;

    let internet_probe = http_probe(&state.config.public_probe_url, state.config.request_timeout_ms).await;
    db::insert_connectivity_check(&state.db, now, &state.config.public_probe_url, "internet", internet_probe.success, internet_probe.latency_ms, internet_probe.error_message.as_deref()).await?;
    alerts::evaluate_connectivity(state, "internet", &state.config.public_probe_url, &internet_probe).await?;

    Ok(())
}

async fn tcp_probe(addr: &str, timeout_ms: u64) -> ProbeResult {
    let start = Instant::now();
    match timeout(Duration::from_millis(timeout_ms), TcpStream::connect(addr)).await {
        Ok(Ok(_)) => ProbeResult { success: true, latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0), error_message: None },
        Ok(Err(err)) => ProbeResult { success: false, latency_ms: None, error_message: Some(err.to_string()) },
        Err(_) => ProbeResult { success: false, latency_ms: None, error_message: Some("tcp probe timed out".to_string()) },
    }
}

async fn http_probe(url: &str, timeout_ms: u64) -> ProbeResult {
    let client = match reqwest::Client::builder().timeout(Duration::from_millis(timeout_ms)).build() {
        Ok(client) => client,
        Err(err) => return ProbeResult { success: false, latency_ms: None, error_message: Some(err.to_string()) },
    };
    let start = Instant::now();
    match client.get(url).send().await {
        Ok(response) if response.status().is_success() => ProbeResult { success: true, latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0), error_message: None },
        Ok(response) => ProbeResult { success: false, latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0), error_message: Some(format!("unexpected status {}", response.status())) },
        Err(err) => ProbeResult { success: false, latency_ms: None, error_message: Some(err.to_string()) },
    }
}
