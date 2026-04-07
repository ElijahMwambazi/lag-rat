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
        DeviceHistoryItem, EnrichedDevice, HealthCurrentResponse, KnownDeviceView,
        OutageReportItem, SaveKnownDeviceRequest, SummaryResponse, TimeseriesPoint,
    },
    services::{devices, status_overview},
    state::AppState,
};

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
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/status/overview", get(get_status_overview))
        .route("/api/health/current", get(get_current_health))
        .route("/api/health/history", get(get_health_history))
        .route("/api/health/history/tcp", get(get_health_history_tcp))
        .route("/api/dns/history", get(get_dns_history))
        .route("/api/stats/summary", get(get_summary))
        .route("/api/alerts", get(get_alerts))
        .route("/api/outages", get(get_outages))
        .route("/api/devices", get(get_devices))
        .route("/api/devices/known", post(save_known_device))
        .route("/api/devices/{ip}/history", get(get_device_history))
        .with_state(state)
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub minutes: Option<u32>,
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

async fn get_alerts(
    State(state): State<AppState>,
) -> Result<Json<Vec<AlertView>>, (StatusCode, Json<serde_json::Value>)> {
    let alerts = db::list_alerts(&state.db, 100)
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
        })
        .collect();

    Ok(Json(views))
}

async fn get_outages(
    State(state): State<AppState>,
) -> Result<Json<Vec<OutageReportItem>>, (StatusCode, Json<serde_json::Value>)> {
    let outages = db::list_outages(&state.db, 100)
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

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": err.to_string() })),
    )
}
