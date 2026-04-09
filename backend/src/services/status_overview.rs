use chrono::Utc;

use crate::{
    db,
    models::{
        AlertOverview, ConnectivityCheck, DeviceOverview, DnsStatus, OutageOverview, ServiceStatus,
        StatusOverviewResponse,
    },
    state::AppState,
};

fn map_service(
    latest: Option<ConnectivityCheck>,
    success: Option<ConnectivityCheck>,
    failure: Option<ConnectivityCheck>,
    active_outage: bool,
) -> ServiceStatus {
    ServiceStatus {
        is_healthy: latest.as_ref().map(|row| row.success).unwrap_or(false),
        last_success_at: success.map(|row| row.timestamp),
        last_failure_at: failure.map(|row| row.timestamp),
        latest_latency_ms: latest.as_ref().and_then(|row| row.latency_ms),
        latest_error_message: latest.and_then(|row| row.error_message),
        active_outage,
    }
}

pub async fn build(state: &AppState) -> anyhow::Result<StatusOverviewResponse> {
    let router_target = format!("{}:{}", state.config.router_ip, state.config.router_port);
    let internet_tcp_target = format!(
        "{}:{}",
        state.config.internet_tcp_host, state.config.internet_tcp_port
    );

    let router_latest = db::latest_connectivity_check(&state.db, "router_tcp").await?;
    let router_last_success =
        db::last_successful_connectivity_check(&state.db, "router_tcp").await?;
    let router_last_failure = db::last_failed_connectivity_check(&state.db, "router_tcp").await?;
    let router_active_outage =
        db::active_outage_exists(&state.db, "router_tcp", &router_target).await?;

    let internet_tcp_latest = db::latest_connectivity_check(&state.db, "internet_tcp").await?;
    let internet_tcp_last_success =
        db::last_successful_connectivity_check(&state.db, "internet_tcp").await?;
    let internet_tcp_last_failure =
        db::last_failed_connectivity_check(&state.db, "internet_tcp").await?;
    let internet_tcp_active_outage =
        db::active_outage_exists(&state.db, "internet_tcp", &internet_tcp_target).await?;

    let internet_http_latest = db::latest_connectivity_check(&state.db, "internet_http").await?;
    let internet_http_last_success =
        db::last_successful_connectivity_check(&state.db, "internet_http").await?;
    let internet_http_last_failure =
        db::last_failed_connectivity_check(&state.db, "internet_http").await?;
    let internet_http_active_outage =
        db::active_outage_exists(&state.db, "internet_http", &state.config.public_probe_url)
            .await?;

    let dns_latest = db::latest_dns_check(&state.db).await?;
    let dns_last_success = db::last_successful_dns_check(&state.db).await?;
    let dns_last_failure = db::last_failed_dns_check(&state.db).await?;
    let dns_active_outage =
        db::active_outage_exists(&state.db, "dns", &state.config.dns_test_domain).await?;

    let active_count_24h = db::device_count_seen_since_hours(&state.db, 24).await?;
    let most_recent_seen_at = db::most_recent_device_seen(&state.db).await?;
    let active_outage_count = db::active_outages_count(&state.db).await?;
    let last_24h_count = db::outage_count_since_hours(&state.db, 24).await?;

    let active_alert_count = db::active_alerts_count(&state.db).await?;
    let active_critical_alert_count = db::active_critical_alerts_count(&state.db).await?;
    let active_unacknowledged_alert_count =
        db::active_unacknowledged_alerts_count(&state.db).await?;
    let active_unacknowledged_critical_alert_count =
        db::active_unacknowledged_critical_alerts_count(&state.db).await?;
    let most_recent_alert_created_at = db::most_recent_alert_created_at(&state.db).await?;

    let checked_at = [
        router_latest.as_ref().map(|row| row.timestamp),
        internet_tcp_latest.as_ref().map(|row| row.timestamp),
        internet_http_latest.as_ref().map(|row| row.timestamp),
        dns_latest.as_ref().map(|row| row.timestamp),
        most_recent_seen_at,
        most_recent_alert_created_at,
    ]
    .into_iter()
    .flatten()
    .max()
    .unwrap_or_else(Utc::now);

    let internet_summary_healthy = internet_tcp_latest
        .as_ref()
        .map(|r| r.success)
        .unwrap_or(false)
        && internet_http_latest
            .as_ref()
            .map(|r| r.success)
            .unwrap_or(false);

    let internet_summary = ServiceStatus {
        is_healthy: internet_summary_healthy,
        last_success_at: internet_http_last_success
            .as_ref()
            .map(|row| row.timestamp)
            .or_else(|| internet_tcp_last_success.as_ref().map(|row| row.timestamp)),
        last_failure_at: internet_http_last_failure
            .as_ref()
            .map(|row| row.timestamp)
            .or_else(|| internet_tcp_last_failure.as_ref().map(|row| row.timestamp)),
        latest_latency_ms: internet_http_latest.as_ref().and_then(|row| row.latency_ms),
        latest_error_message: internet_http_latest
            .as_ref()
            .and_then(|row| row.error_message.clone())
            .or_else(|| {
                internet_tcp_latest
                    .as_ref()
                    .and_then(|row| row.error_message.clone())
            }),
        active_outage: internet_tcp_active_outage || internet_http_active_outage,
    };

    Ok(StatusOverviewResponse {
        checked_at,
        router: map_service(
            router_latest,
            router_last_success,
            router_last_failure,
            router_active_outage,
        ),
        internet: internet_summary,
        internet_tcp: map_service(
            internet_tcp_latest,
            internet_tcp_last_success,
            internet_tcp_last_failure,
            internet_tcp_active_outage,
        ),
        internet_http: map_service(
            internet_http_latest,
            internet_http_last_success,
            internet_http_last_failure,
            internet_http_active_outage,
        ),
        dns: DnsStatus {
            is_healthy: dns_latest.as_ref().map(|row| row.success).unwrap_or(false),
            last_success_at: dns_last_success.map(|row| row.timestamp),
            last_failure_at: dns_last_failure.map(|row| row.timestamp),
            latest_response_time_ms: dns_latest.as_ref().and_then(|row| row.response_time_ms),
            latest_error_message: dns_latest.and_then(|row| row.error_message),
            active_outage: dns_active_outage,
        },
        devices: DeviceOverview {
            active_count_24h,
            most_recent_seen_at,
        },
        outages: OutageOverview {
            active_count: active_outage_count,
            last_24h_count,
        },
        alerts: AlertOverview {
            active_count: active_alert_count,
            active_critical_count: active_critical_alert_count,
            active_unacknowledged_count: active_unacknowledged_alert_count,
            active_unacknowledged_critical_count: active_unacknowledged_critical_alert_count,
            most_recent_created_at: most_recent_alert_created_at,
        },
    })
}
