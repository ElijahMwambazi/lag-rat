use chrono::Utc;
use crate::{db, monitors::connectivity::ProbeResult, state::AppState};

pub async fn evaluate_connectivity(state: &AppState, service: &str, entity_key: &str, probe: &ProbeResult) -> anyhow::Result<()> {
    let message = match &probe.error_message {
        Some(err) => format!("{service} check failed: {err}"),
        None => format!("{service} check recovered"),
    };
    db::upsert_alert_state(&state.db, "service_health", if probe.success { "info" } else { "critical" }, service, entity_key, &message, !probe.success, Utc::now()).await
}

pub async fn evaluate_dns(state: &AppState, domain: &str, success: bool, error_message: Option<&str>) -> anyhow::Result<()> {
    let message = match error_message {
        Some(err) => format!("dns check failed for {domain}: {err}"),
        None => format!("dns check recovered for {domain}"),
    };
    db::upsert_alert_state(&state.db, "dns_health", if success { "info" } else { "critical" }, "dns", domain, &message, !success, Utc::now()).await
}
