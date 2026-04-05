use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::{
    db,
    models::{Device, HealthCurrentResponse, OutageReportItem, SummaryResponse, TimeseriesPoint},
    services::status_overview,
    state::AppState,
};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/status/overview", get(get_status_overview))
        .route("/api/health/current", get(get_current_health))
        .route("/api/health/history", get(get_health_history))
        .route("/api/dns/history", get(get_dns_history))
        .route("/api/outages", get(get_outages))
        .route("/api/devices", get(get_devices))
        .route("/api/stats/summary", get(get_summary))
        .with_state(state)
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub minutes: Option<u32>,
}

async fn get_status_overview(
    State(state): State<AppState>,
) -> Result<Json<crate::models::StatusOverviewResponse>, (StatusCode, Json<serde_json::Value>)> {
    let overview = status_overview::build(&state)
        .await
        .map_err(internal_error)?;
    Ok(Json(overview))
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
    let points = db::connectivity_timeseries(&state.db, "internet", minutes)
        .await
        .map_err(internal_error)?;
    Ok(Json(points))
}

async fn get_dns_history(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<TimeseriesPoint>>, (StatusCode, Json<serde_json::Value>)> {
    let minutes = query.minutes.unwrap_or(60).min(24 * 60) as i64;
    let points = db::dns_timeseries(&state.db, minutes)
        .await
        .map_err(internal_error)?;
    Ok(Json(points))
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
                status: if outage.is_active { "active".to_string() } else { "resolved".to_string() },
            }
        })
        .collect();

    Ok(Json(items))
}

async fn get_devices(
    State(state): State<AppState>,
) -> Result<Json<Vec<Device>>, (StatusCode, Json<serde_json::Value>)> {
    let devices = db::list_devices(&state.db, 100)
        .await
        .map_err(internal_error)?;
    Ok(Json(devices))
}

async fn get_summary(
    State(state): State<AppState>,
) -> Result<Json<SummaryResponse>, (StatusCode, Json<serde_json::Value>)> {
    let summary = db::summary_24h(&state.db)
        .await
        .map_err(internal_error)?;
    Ok(Json(summary))
}

fn internal_error(err: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": err.to_string() })),
    )
}
