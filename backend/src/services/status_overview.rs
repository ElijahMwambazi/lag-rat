use chrono::Utc;

use crate::{
    db,
    models::{DeviceOverview, DnsStatus, OutageOverview, ServiceStatus, StatusOverviewResponse},
    state::AppState,
};

pub async fn build(state: &AppState) -> anyhow::Result<StatusOverviewResponse> {
    let router_latest = db::latest_connectivity_check(&state.db, "router").await?;
    let router_last_success = db::last_successful_connectivity_check(&state.db, "router").await?;
    let router_last_failure = db::last_failed_connectivity_check(&state.db, "router").await?;
    let router_active_outage = db::active_outage_exists(&state.db, "router", &format!("{}:{}", state.config.router_ip, state.config.router_port)).await?;

    let internet_latest = db::latest_connectivity_check(&state.db, "internet").await?;
    let internet_last_success = db::last_successful_connectivity_check(&state.db, "internet").await?;
    let internet_last_failure = db::last_failed_connectivity_check(&state.db, "internet").await?;
    let internet_active_outage = db::active_outage_exists(&state.db, "internet", &state.config.public_probe_url).await?;

    let dns_latest = db::latest_dns_check(&state.db).await?;
    let dns_last_success = db::last_successful_dns_check(&state.db).await?;
    let dns_last_failure = db::last_failed_dns_check(&state.db).await?;
    let dns_active_outage = db::active_outage_exists(&state.db, "dns", &state.config.dns_test_domain).await?;

    let active_count_24h = db::device_count_seen_since_hours(&state.db, 24).await?;
    let most_recent_seen_at = db::most_recent_device_seen(&state.db).await?;
    let active_outage_count = db::active_outages_count(&state.db).await?;
    let last_24h_count = db::outage_count_since_hours(&state.db, 24).await?;

    let checked_at = [
        router_latest.as_ref().map(|row| row.timestamp),
        internet_latest.as_ref().map(|row| row.timestamp),
        dns_latest.as_ref().map(|row| row.timestamp),
        most_recent_seen_at,
    ].into_iter().flatten().max().unwrap_or_else(Utc::now);

    Ok(StatusOverviewResponse {
        checked_at,
        router: ServiceStatus {
            is_healthy: router_latest.as_ref().map(|row| row.success).unwrap_or(false),
            last_success_at: router_last_success.map(|row| row.timestamp),
            last_failure_at: router_last_failure.map(|row| row.timestamp),
            latest_latency_ms: router_latest.as_ref().and_then(|row| row.latency_ms),
            latest_error_message: router_latest.and_then(|row| row.error_message),
            active_outage: router_active_outage,
        },
        internet: ServiceStatus {
            is_healthy: internet_latest.as_ref().map(|row| row.success).unwrap_or(false),
            last_success_at: internet_last_success.map(|row| row.timestamp),
            last_failure_at: internet_last_failure.map(|row| row.timestamp),
            latest_latency_ms: internet_latest.as_ref().and_then(|row| row.latency_ms),
            latest_error_message: internet_latest.and_then(|row| row.error_message),
            active_outage: internet_active_outage,
        },
        dns: DnsStatus {
            is_healthy: dns_latest.as_ref().map(|row| row.success).unwrap_or(false),
            last_success_at: dns_last_success.map(|row| row.timestamp),
            last_failure_at: dns_last_failure.map(|row| row.timestamp),
            latest_response_time_ms: dns_latest.as_ref().and_then(|row| row.response_time_ms),
            latest_error_message: dns_latest.and_then(|row| row.error_message),
            active_outage: dns_active_outage,
        },
        devices: DeviceOverview { active_count_24h, most_recent_seen_at },
        outages: OutageOverview { active_count: active_outage_count, last_24h_count },
    })
}
