use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::{
    db,
    models::{
        AlertHistoryItem, DeviceHistoryItem, EnrichedDevice, HealthCurrentResponse,
        IncidentTargetSummaryItem, KnownDeviceView, MetricsSummaryResponse, OutageReportItem,
        RecentAlertEventItem, RecentDeviceEventItem, ReportSnapshotResponse, ReportSummaryResponse,
        ReportTrendPoint, SaveKnownDeviceRequest, SummaryResponse, TimeseriesPoint, TrafficSample,
        TrafficSummaryResponse, TrafficTopTalkersResponse, WifiSample,
    },
    services::{devices, status_overview},
    state::AppState,
};

#[derive(Deserialize)]
pub struct OutageQuery {
    pub status: Option<String>,
    pub outage_type: Option<String>,
    pub search: Option<String>,
    pub limit: Option<u32>,
}

#[derive(serde::Serialize)]
pub struct AlertView {
    pub id: i32,
    pub alert_type: String,
    pub severity: String,
    pub entity_type: String,
    pub entity_key: String,
    pub message: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
pub struct AlertQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub entity_type: Option<String>,
    pub search: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub minutes: Option<u32>,
}

#[derive(Deserialize)]
pub struct ReportsSummaryQuery {
    pub hours: Option<u32>,
}

#[derive(Deserialize)]
pub struct WifiQuery {
    pub minutes: Option<u32>,
    pub location_label: Option<String>,
    pub limit: Option<u32>,
}

#[derive(serde::Serialize)]
pub struct WifiSummaryResponse {
    pub window_minutes: u32,
    pub location_label: Option<String>,
    pub sample_count: u32,
    pub avg_rssi_dbm: Option<f64>,
    pub min_rssi_dbm: Option<i64>,
    pub max_rssi_dbm: Option<i64>,
    pub latest_sample: Option<WifiSample>,
}

#[derive(serde::Serialize)]
pub struct WifiLocationsResponse {
    pub items: Vec<String>,
}

#[derive(serde::Serialize)]
pub struct WifiLocationSummaryItem {
    pub location_label: String,
    pub sample_count: u32,
    pub avg_rssi_dbm: Option<f64>,
    pub min_rssi_dbm: Option<i64>,
    pub max_rssi_dbm: Option<i64>,
    pub latest_sample: Option<WifiSample>,
}

#[derive(serde::Serialize)]
pub struct WifiLocationSummariesResponse {
    pub window_minutes: u32,
    pub items: Vec<WifiLocationSummaryItem>,
}

#[derive(Debug, Deserialize)]
struct TrafficWindowQuery {
    minutes: Option<u32>,
    limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct WifiLatestQuery {
    location_label: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrafficSamplesQuery {
    minutes: Option<u32>,
    limit: Option<u32>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/status/overview", get(get_status_overview))
        .route("/api/health/current", get(get_current_health))
        .route("/api/health/history", get(get_health_history))
        .route("/api/health/history/tcp", get(get_health_history_tcp))
        .route("/api/dns/history", get(get_dns_history))
        .route("/api/stats/summary", get(get_summary))
        .route("/api/reports/summary", get(get_reports_summary))
        .route("/api/metrics/summary", get(get_metrics_summary))
        .route("/api/reports/snapshot", get(get_reports_snapshot))
        .route("/api/alerts", get(get_alerts))
        .route(
            "/api/reports/alerts/recent",
            get(get_recent_report_alert_events),
        )
        .route(
            "/api/reports/devices/recent",
            get(get_recent_report_device_events),
        )
        .route("/api/reports/trends", get(get_reports_trends))
        .route("/api/outages", get(get_outages))
        .route("/api/devices", get(get_devices))
        .route("/api/devices/known", post(save_known_device))
        .route("/api/devices/{ip}/history", get(get_device_history))
        .route("/api/alerts/{id}/acknowledge", post(acknowledge_alert))
        .route("/api/alerts/{id}/history", get(get_alert_history))
        .route(
            "/api/reports/incidents/top",
            get(get_top_report_incident_targets),
        )
        .route("/api/wifi/samples", get(get_wifi_samples))
        .route("/api/wifi/latest", get(get_latest_wifi_sample))
        .route("/api/wifi/summary", get(get_wifi_summary))
        .route("/api/wifi/locations", get(get_wifi_locations))
        .route(
            "/api/wifi/locations/summary",
            get(get_wifi_location_summaries),
        )
        .route("/api/traffic/summary", get(get_traffic_summary))
        .route("/api/traffic/top-talkers", get(get_traffic_top_talkers))
        .route("/api/traffic/samples", get(get_traffic_samples))
        .with_state(state)
}

async fn get_status_overview(
    State(state): State<AppState>,
) -> Result<Json<crate::models::StatusOverviewResponse>, (StatusCode, Json<serde_json::Value>)> {
    Ok(Json(
        status_overview::build(&state)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_current_health(
    State(state): State<AppState>,
) -> Result<Json<HealthCurrentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let router = db::latest_connectivity_success(&state.db, "router")
        .await
        .map_err(internal_error)?;
    let internet = db::latest_connectivity_success(&state.db, "internet")
        .await
        .map_err(internal_error)?;
    let dns = db::latest_dns_success(&state.db)
        .await
        .map_err(internal_error)?;
    let checked_at = [
        router.as_ref().map(|(_, ts)| *ts),
        internet.as_ref().map(|(_, ts)| *ts),
        dns.as_ref().map(|(_, ts)| *ts),
    ]
    .into_iter()
    .flatten()
    .max()
    .unwrap_or_else(Utc::now);

    Ok(Json(HealthCurrentResponse {
        router_ip: state.config.router_ip.clone(),
        router_reachable: router.map(|(success, _)| success).unwrap_or(false),
        internet_reachable: internet.map(|(success, _)| success).unwrap_or(false),
        dns_healthy: dns.map(|(success, _)| success).unwrap_or(false),
        checked_at,
    }))
}

async fn get_health_history(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<TimeseriesPoint>>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(24 * 60) as i64;
    Ok(Json(
        db::connectivity_timeseries(&state.db, "internet_http", minutes)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_health_history_tcp(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<TimeseriesPoint>>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(24 * 60) as i64;
    Ok(Json(
        db::connectivity_timeseries(&state.db, "internet_tcp", minutes)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_dns_history(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<TimeseriesPoint>>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(24 * 60) as i64;
    Ok(Json(
        db::dns_timeseries(&state.db, minutes)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_summary(
    State(state): State<AppState>,
) -> Result<Json<SummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    Ok(Json(
        db::summary_24h(&state.db).await.map_err(internal_error)?,
    ))
}

async fn get_reports_summary(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<ReportSummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    Ok(Json(
        db::report_summary(&state.db, hours)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_metrics_summary(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<MetricsSummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(60 * 24 * 7) as i64;

    Ok(Json(
        db::metrics_summary(&state.db, minutes)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_reports_trends(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<Vec<ReportTrendPoint>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    Ok(Json(
        db::report_trends(&state.db, hours)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_recent_report_alert_events(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<Vec<RecentAlertEventItem>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    Ok(Json(
        db::recent_alert_events(&state.db, hours, 10)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_recent_report_device_events(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<Vec<RecentDeviceEventItem>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    Ok(Json(
        db::recent_device_events(&state.db, hours, 10)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_top_report_incident_targets(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<Vec<IncidentTargetSummaryItem>>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    Ok(Json(
        db::top_incident_targets(&state.db, hours, 8)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_reports_snapshot(
    State(state): State<AppState>,
    Query(query): Query<ReportsSummaryQuery>,
) -> Result<Json<ReportSnapshotResponse>, (StatusCode, Json<serde_json::Value>)> {
    let hours = query.hours.unwrap_or(24).clamp(1, 24 * 7) as i64;

    let summary = db::report_summary(&state.db, hours)
        .await
        .map_err(internal_error)?;

    let top_incident_targets = db::top_incident_targets(&state.db, hours, 8)
        .await
        .map_err(internal_error)?;

    let recent_alert_events = db::recent_alert_events(&state.db, hours, 10)
        .await
        .map_err(internal_error)?;

    let recent_device_events = db::recent_device_events(&state.db, hours, 10)
        .await
        .map_err(internal_error)?;

    let outages = db::list_outages_filtered(&state.db, None, None, None, 200)
        .await
        .map_err(internal_error)?
        .into_iter()
        .filter(|outage| {
            let window_start = Utc::now() - chrono::Duration::hours(hours);
            outage.started_at >= window_start
        })
        .map(|outage| {
            let duration_seconds = outage
                .ended_at
                .map(|ended_at| (ended_at - outage.started_at).num_seconds());

            OutageReportItem {
                id: outage.id,
                outage_type: outage.outage_type,
                target: outage.target,
                started_at: outage.started_at,
                ended_at: outage.ended_at,
                is_active: outage.is_active,
                start_error: outage.start_error,
                end_note: outage.end_note,
                duration_seconds,
                status: if outage.is_active {
                    "active".to_string()
                } else {
                    "resolved".to_string()
                },
            }
        })
        .collect::<Vec<_>>();

    let top_target = top_incident_targets.first();

    let window_label = if hours < 24 {
        format!("last {hours} hours")
    } else if hours == 24 {
        "last 24 hours".to_string()
    } else if hours % 24 == 0 {
        let days = hours / 24;
        if days == 1 {
            "last 1 day".to_string()
        } else {
            format!("last {days} days")
        }
    } else {
        format!("last {hours} hours")
    };

    let mut parts = Vec::new();
    parts.push(format!(
        "Network uptime was {:.1}% over the {}.",
        summary.uptime_pct, &window_label
    ));
    parts.push(format!(
        "{} outages were recorded, with {} total downtime.",
        summary.outage_count,
        format_duration_compact(summary.total_downtime_seconds)
    ));
    parts.push(format!(
        "{} DNS failures occurred in this window.",
        summary.dns_failure_count
    ));
    parts.push(format!(
        "There are currently {} active alerts, including {} critical and {} unacknowledged.",
        summary.active_alert_count,
        summary.active_critical_alert_count,
        summary.active_unacknowledged_alert_count
    ));
    parts.push(format!(
        "{} device changes were recorded.",
        summary.device_history_event_count
    ));

    if let Some(item) = top_target {
        parts.push(format!(
            "The most frequent incident target was {}, with {} incidents and {} downtime.",
            item.target,
            item.count,
            format_duration_compact(item.total_downtime_seconds)
        ));
    }

    let narrative = parts.join(" ");

    Ok(Json(ReportSnapshotResponse {
        generated_at: Utc::now(),
        window_hours: hours as u32,
        narrative,
        summary,
        top_incident_targets,
        recent_alert_events,
        recent_device_events,
        outages,
    }))
}

async fn get_alerts(
    State(state): State<AppState>,
    Query(query): Query<AlertQuery>,
) -> Result<Json<Vec<AlertView>>, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(100).min(500) as i64;

    let alerts = db::list_alerts_filtered(
        &state.db,
        query.status.as_deref(),
        query.severity.as_deref(),
        query.entity_type.as_deref(),
        query.search.as_deref(),
        limit,
    )
    .await
    .map_err(internal_error)?;

    let views = alerts
        .into_iter()
        .map(|alert| AlertView {
            id: alert.id as i32,
            alert_type: alert.alert_type,
            severity: alert.severity,
            entity_type: alert.entity_type,
            entity_key: alert.entity_key,
            message: alert.message,
            is_active: alert.is_active,
            created_at: alert.created_at,
            resolved_at: alert.resolved_at,
            acknowledged_at: alert.acknowledged_at,
        })
        .collect();

    Ok(Json(views))
}

async fn acknowledge_alert(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<AlertView>, (StatusCode, Json<serde_json::Value>)> {
    let acknowledged = db::acknowledge_alert(&state.db, id, Utc::now())
        .await
        .map_err(internal_error)?;

    let alert = match acknowledged {
        Some(alert) => alert,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "alert not found" })),
            ))
        }
    };

    Ok(Json(AlertView {
        id: alert.id as i32,
        alert_type: alert.alert_type,
        severity: alert.severity,
        entity_type: alert.entity_type,
        entity_key: alert.entity_key,
        message: alert.message,
        is_active: alert.is_active,
        created_at: alert.created_at,
        resolved_at: alert.resolved_at,
        acknowledged_at: alert.acknowledged_at,
    }))
}

async fn get_alert_history(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Vec<AlertHistoryItem>>, (StatusCode, Json<serde_json::Value>)> {
    let alert = db::get_alert_by_id(&state.db, id)
        .await
        .map_err(internal_error)?;

    if alert.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "alert not found" })),
        ));
    }

    let items = db::list_alert_history(&state.db, id, 20)
        .await
        .map_err(internal_error)?
        .into_iter()
        .map(|event| AlertHistoryItem {
            id: event.id,
            event_type: event.event_type,
            previous_value: event.previous_value,
            new_value: event.new_value,
            created_at: event.created_at,
        })
        .collect();

    Ok(Json(items))
}

async fn get_outages(
    State(state): State<AppState>,
    Query(query): Query<OutageQuery>,
) -> Result<Json<Vec<OutageReportItem>>, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(100).min(500) as i64;

    let outages = db::list_outages_filtered(
        &state.db,
        query.status.as_deref(),
        query.outage_type.as_deref(),
        query.search.as_deref(),
        limit,
    )
    .await
    .map_err(internal_error)?;

    let items = outages
        .into_iter()
        .map(|outage| {
            let duration_seconds = outage
                .ended_at
                .map(|ended_at| (ended_at - outage.started_at).num_seconds());

            OutageReportItem {
                id: outage.id,
                outage_type: outage.outage_type,
                target: outage.target,
                started_at: outage.started_at,
                ended_at: outage.ended_at,
                is_active: outage.is_active,
                start_error: outage.start_error,
                end_note: outage.end_note,
                duration_seconds,
                status: if outage.is_active {
                    "active".to_string()
                } else {
                    "resolved".to_string()
                },
            }
        })
        .collect();

    Ok(Json(items))
}

async fn get_devices(
    State(state): State<AppState>,
) -> Result<Json<Vec<EnrichedDevice>>, (StatusCode, Json<serde_json::Value>)> {
    let devices = devices::list_enriched(&state)
        .await
        .map_err(internal_error)?;

    Ok(Json(devices))
}

async fn save_known_device(
    State(state): State<AppState>,
    Json(payload): Json<SaveKnownDeviceRequest>,
) -> Result<Json<KnownDeviceView>, (StatusCode, Json<serde_json::Value>)> {
    let label = payload.label.trim();
    if label.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "label is required" })),
        ));
    }

    if payload.ip_address.as_deref().unwrap_or("").is_empty()
        && payload.mac_address.as_deref().unwrap_or("").is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "ip_address or mac_address is required" })),
        ));
    }

    let saved = db::save_known_device(
        &state.db,
        payload.ip_address.as_deref(),
        payload.mac_address.as_deref(),
        label,
        payload.notes.as_deref(),
    )
    .await
    .map_err(internal_error)?;

    Ok(Json(KnownDeviceView {
        id: saved.id,
        ip_address: saved.ip_address,
        mac_address: saved.mac_address,
        label: saved.label,
        notes: saved.notes,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
    }))
}

async fn get_device_history(
    State(state): State<AppState>,
    Path(ip): Path<String>,
) -> Result<Json<Vec<DeviceHistoryItem>>, (StatusCode, Json<serde_json::Value>)> {
    let items = db::list_device_history(&state.db, &ip, 20)
        .await
        .map_err(internal_error)?
        .into_iter()
        .map(|event| DeviceHistoryItem {
            id: event.id,
            event_type: event.event_type,
            previous_value: event.previous_value,
            new_value: event.new_value,
            created_at: event.created_at,
        })
        .collect();

    Ok(Json(items))
}

async fn get_wifi_samples(
    State(state): State<AppState>,
    Query(query): Query<WifiQuery>,
) -> Result<Json<Vec<WifiSample>>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(60 * 24 * 7) as i64;
    let limit = query.limit.unwrap_or(100).min(500) as i64;

    Ok(Json(
        db::list_wifi_samples_filtered(&state.db, minutes, query.location_label.as_deref(), limit)
            .await
            .map_err(internal_error)?,
    ))
}

async fn get_latest_wifi_sample(
    State(state): State<AppState>,
    Query(query): Query<WifiLatestQuery>,
) -> Result<Json<WifiSample>, StatusCode> {
    let item = if let Some(location_label) = query.location_label.as_deref() {
        db::latest_wifi_sample_for_location(&state.db, location_label)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        db::latest_wifi_sample(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    item.map(Json).ok_or(StatusCode::NOT_FOUND)
}

async fn get_wifi_summary(
    State(state): State<AppState>,
    Query(query): Query<WifiQuery>,
) -> Result<Json<WifiSummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(60 * 24 * 7) as i64;

    let (latest_sample, sample_count, avg_rssi_dbm, min_rssi_dbm, max_rssi_dbm) =
        db::wifi_summary(&state.db, minutes, query.location_label.as_deref())
            .await
            .map_err(internal_error)?;

    Ok(Json(WifiSummaryResponse {
        window_minutes: minutes as u32,
        location_label: query.location_label,
        sample_count,
        avg_rssi_dbm,
        min_rssi_dbm,
        max_rssi_dbm,
        latest_sample,
    }))
}

async fn get_wifi_locations(
    State(state): State<AppState>,
) -> Result<Json<WifiLocationsResponse>, (StatusCode, Json<serde_json::Value>)> {
    Ok(Json(WifiLocationsResponse {
        items: db::list_wifi_locations(&state.db)
            .await
            .map_err(internal_error)?,
    }))
}

async fn get_wifi_location_summaries(
    State(state): State<AppState>,
    Query(query): Query<WifiQuery>,
) -> Result<Json<WifiLocationSummariesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(60 * 24 * 7) as i64;

    let items = db::wifi_location_summaries(&state.db, minutes)
        .await
        .map_err(internal_error)?
        .into_iter()
        .map(
            |(
                location_label,
                latest_sample,
                sample_count,
                avg_rssi_dbm,
                min_rssi_dbm,
                max_rssi_dbm,
            )| WifiLocationSummaryItem {
                location_label,
                sample_count,
                avg_rssi_dbm,
                min_rssi_dbm,
                max_rssi_dbm,
                latest_sample,
            },
        )
        .collect();

    Ok(Json(WifiLocationSummariesResponse {
        window_minutes: minutes as u32,
        items,
    }))
}

async fn get_traffic_summary(
    State(state): State<AppState>,
    Query(query): Query<TrafficWindowQuery>,
) -> Result<Json<TrafficSummaryResponse>, StatusCode> {
    let minutes = query.minutes.unwrap_or(60) as i64;

    let (total_bytes_rx, total_bytes_tx, interface_count, top_talker) =
        db::traffic_summary(&state.db, minutes)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TrafficSummaryResponse {
        window_minutes: minutes as u32,
        total_bytes_rx,
        total_bytes_tx,
        total_bytes: total_bytes_rx + total_bytes_tx,
        interface_count,
        top_talker,
    }))
}

async fn get_traffic_top_talkers(
    State(state): State<AppState>,
    Query(query): Query<TrafficWindowQuery>,
) -> Result<Json<TrafficTopTalkersResponse>, StatusCode> {
    let minutes = query.minutes.unwrap_or(60) as i64;
    let limit = query.limit.unwrap_or(5) as i64;

    let items = db::traffic_top_talkers(&state.db, minutes, limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TrafficTopTalkersResponse {
        window_minutes: minutes as u32,
        items,
    }))
}

fn format_duration_compact(seconds: i64) -> String {
    if seconds < 60 {
        format!("{seconds}s")
    } else if seconds < 3600 {
        format!("{}m", seconds / 60)
    } else {
        format!("{}h {}m", seconds / 3600, (seconds % 3600) / 60)
    }
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": err.to_string() })),
    )
}

async fn get_traffic_samples(
    State(state): State<AppState>,
    Query(query): Query<TrafficSamplesQuery>,
) -> Result<Json<Vec<TrafficSample>>, StatusCode> {
    let minutes = query.minutes.unwrap_or(60) as i64;
    let limit = query.limit.unwrap_or(50) as i64;

    let items = db::list_traffic_samples(&state.db, minutes, limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(items))
}
