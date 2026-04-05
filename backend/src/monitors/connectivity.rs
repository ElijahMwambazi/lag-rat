use std::time::{Duration, Instant};

use chrono::Utc;
use tokio::{net::TcpStream, time::timeout};

use crate::{db, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let router_target = format!("{}:{}", state.config.router_ip, state.config.router_port);
    let router_probe = tcp_probe(&router_target, state.config.request_timeout_ms).await;

    db::insert_connectivity_check(
        &state.db,
        Utc::now(),
        &router_target,
        "router",
        router_probe.success,
        router_probe.latency_ms,
        router_probe.error_message.as_deref(),
    )
    .await?;

    let internet_probe = http_probe(&state.config.public_probe_url, state.config.request_timeout_ms).await;

    db::insert_connectivity_check(
        &state.db,
        Utc::now(),
        &state.config.public_probe_url,
        "internet",
        internet_probe.success,
        internet_probe.latency_ms,
        internet_probe.error_message.as_deref(),
    )
    .await?;

    Ok(())
}

struct ProbeResult {
    success: bool,
    latency_ms: Option<f64>,
    error_message: Option<String>,
}

async fn tcp_probe(addr: &str, timeout_ms: u64) -> ProbeResult {
    let start = Instant::now();
    match timeout(Duration::from_millis(timeout_ms), TcpStream::connect(addr)).await {
        Ok(Ok(_)) => ProbeResult {
            success: true,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error_message: None,
        },
        Ok(Err(err)) => ProbeResult {
            success: false,
            latency_ms: None,
            error_message: Some(err.to_string()),
        },
        Err(_) => ProbeResult {
            success: false,
            latency_ms: None,
            error_message: Some("tcp probe timed out".to_string()),
        },
    }
}

async fn http_probe(url: &str, timeout_ms: u64) -> ProbeResult {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build();

    let client = match client {
        Ok(client) => client,
        Err(err) => {
            return ProbeResult {
                success: false,
                latency_ms: None,
                error_message: Some(err.to_string()),
            }
        }
    };

    let start = Instant::now();
    match client.get(url).send().await {
        Ok(response) if response.status().is_success() => ProbeResult {
            success: true,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error_message: None,
        },
        Ok(response) => ProbeResult {
            success: false,
            latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
            error_message: Some(format!("unexpected status {}", response.status())),
        },
        Err(err) => ProbeResult {
            success: false,
            latency_ms: None,
            error_message: Some(err.to_string()),
        },
    }
}
