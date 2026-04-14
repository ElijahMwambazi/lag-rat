use std::time::{Duration, Instant};

use chrono::Utc;
use tokio::{net::lookup_host, time::timeout};

use crate::{
    models::{CollectorObservation, DnsObservation},
    services::collector_ingest,
    state::AppState,
};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let start = Instant::now();
    let observed_at = Utc::now();
    let target = format!("{}:80", state.config.dns_test_domain);

    let result = timeout(
        Duration::from_millis(state.config.request_timeout_ms),
        lookup_host(target),
    )
    .await;

    let observation = match result {
        Ok(Ok(mut addrs)) => {
            let success = addrs.next().is_some();
            let response_time_ms = Some(start.elapsed().as_secs_f64() * 1000.0);
            let error_message = if success {
                None
            } else {
                Some("no addresses returned".to_string())
            };

            DnsObservation {
                module: "home_network".to_string(),
                collector_type: "dns_lookup".to_string(),
                domain: state.config.dns_test_domain.clone(),
                resolver: state.config.dns_resolver.clone(),
                entity_type: "dns".to_string(),
                entity_key: state.config.dns_test_domain.clone(),
                observed_at,
                success,
                response_time_ms,
                error_message,
            }
        }
        Ok(Err(err)) => DnsObservation {
            module: "home_network".to_string(),
            collector_type: "dns_lookup".to_string(),
            domain: state.config.dns_test_domain.clone(),
            resolver: state.config.dns_resolver.clone(),
            entity_type: "dns".to_string(),
            entity_key: state.config.dns_test_domain.clone(),
            observed_at,
            success: false,
            response_time_ms: None,
            error_message: Some(err.to_string()),
        },
        Err(_) => DnsObservation {
            module: "home_network".to_string(),
            collector_type: "dns_lookup".to_string(),
            domain: state.config.dns_test_domain.clone(),
            resolver: state.config.dns_resolver.clone(),
            entity_type: "dns".to_string(),
            entity_key: state.config.dns_test_domain.clone(),
            observed_at,
            success: false,
            response_time_ms: None,
            error_message: Some("dns probe timed out".to_string()),
        },
    };

    collector_ingest::ingest(state, CollectorObservation::Dns(observation)).await
}
