use std::{
    process::Command,
    time::{Duration, Instant},
};

use chrono::Utc;
use tokio::{net::TcpStream, time::timeout};

use crate::{
    models::{CollectorObservation, ServiceObservation},
    services::collector_ingest,
    state::AppState,
};

#[derive(Debug, Clone)]
pub struct ProbeResult {
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error_message: Option<String>,
}

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let now = Utc::now();

    let router_ip = resolve_router_ip(&state.config.router_ip);
    let router_target = format!("{}:{}", router_ip, state.config.router_port);
    let router_probe = tcp_probe(&router_target, state.config.request_timeout_ms).await;
    collector_ingest::ingest(
        state,
        CollectorObservation::Connectivity(ServiceObservation {
            module: "home_network".to_string(),
            collector_type: "router_tcp".to_string(),
            target: router_target.clone(),
            target_type: "router".to_string(),
            entity_type: "router_tcp".to_string(),
            entity_key: router_target,
            observed_at: now,
            success: router_probe.success,
            latency_ms: router_probe.latency_ms,
            error_message: router_probe.error_message,
        }),
    )
    .await?;

    for target in &state.config.internet_tcp_targets {
        let internet_tcp_target = format!("{}:{}", target.host, target.port);
        let internet_tcp_probe =
            tcp_probe(&internet_tcp_target, state.config.request_timeout_ms).await;

        collector_ingest::ingest(
            state,
            CollectorObservation::Connectivity(ServiceObservation {
                module: "home_network".to_string(),
                collector_type: "internet_tcp".to_string(),
                target: internet_tcp_target.clone(),
                target_type: "internet".to_string(),
                entity_type: "internet_tcp".to_string(),
                entity_key: internet_tcp_target,
                observed_at: now,
                success: internet_tcp_probe.success,
                latency_ms: internet_tcp_probe.latency_ms,
                error_message: internet_tcp_probe.error_message,
            }),
        )
        .await?;
    }

    for public_probe_url in &state.config.public_probe_urls {
        let internet_http_probe =
            http_probe(public_probe_url, state.config.request_timeout_ms).await;

        collector_ingest::ingest(
            state,
            CollectorObservation::Connectivity(ServiceObservation {
                module: "home_network".to_string(),
                collector_type: "internet_http".to_string(),
                target: public_probe_url.clone(),
                target_type: "internet".to_string(),
                entity_type: "internet_http".to_string(),
                entity_key: public_probe_url.clone(),
                observed_at: now,
                success: internet_http_probe.success,
                latency_ms: internet_http_probe.latency_ms,
                error_message: internet_http_probe.error_message,
            }),
        )
        .await?;
    }

    Ok(())
}

fn resolve_router_ip(configured_router_ip: &str) -> String {
    if configured_router_ip.trim().eq_ignore_ascii_case("auto") {
        return default_gateway_ip().unwrap_or_else(|| configured_router_ip.to_string());
    }

    configured_router_ip.to_string()
}

fn default_gateway_ip() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("ip")
            .args(["route", "show", "default"])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            let mut parts = line.split_whitespace();

            while let Some(part) = parts.next() {
                if part == "via" {
                    return parts.next().map(ToOwned::to_owned);
                }
            }
        }

        None
    }

    #[cfg(not(target_os = "linux"))]
    {
        None
    }
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
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
    {
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
        Ok(response) if response.status().is_success() || response.status().as_u16() == 204 => {
            ProbeResult {
                success: true,
                latency_ms: Some(start.elapsed().as_secs_f64() * 1000.0),
                error_message: None,
            }
        }
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
