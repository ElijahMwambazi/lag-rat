use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct ConnectivityCheck {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub target: String,
    pub target_type: String,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub packet_loss_pct: Option<f64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct DnsCheck {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub domain: String,
    pub resolver: String,
    pub success: bool,
    pub response_time_ms: Option<f64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct Device {
    pub id: i64,
    pub ip_address: String,
    pub mac_address: Option<String>,
    pub hostname: Option<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct Outage {
    pub id: i64,
    pub outage_type: String,
    pub target: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub start_error: Option<String>,
    pub end_note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HealthCurrentResponse {
    pub router_ip: String,
    pub router_reachable: bool,
    pub internet_reachable: bool,
    pub dns_healthy: bool,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TimeseriesPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct SummaryResponse {
    pub uptime_pct_24h: f64,
    pub avg_latency_ms_24h: f64,
    pub outage_count_24h: u32,
}

#[derive(Debug, Serialize)]
pub struct ServiceStatus {
    pub is_healthy: bool,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub latest_latency_ms: Option<f64>,
    pub latest_error_message: Option<String>,
    pub active_outage: bool,
}

#[derive(Debug, Serialize)]
pub struct DnsStatus {
    pub is_healthy: bool,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub latest_response_time_ms: Option<f64>,
    pub latest_error_message: Option<String>,
    pub active_outage: bool,
}

#[derive(Debug, Serialize)]
pub struct DeviceOverview {
    pub active_count_24h: u32,
    pub most_recent_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct OutageOverview {
    pub active_count: u32,
    pub last_24h_count: u32,
}

#[derive(Debug, Serialize)]
pub struct StatusOverviewResponse {
    pub checked_at: DateTime<Utc>,
    pub router: ServiceStatus,
    pub internet: ServiceStatus,
    pub dns: DnsStatus,
    pub devices: DeviceOverview,
    pub outages: OutageOverview,
}

#[derive(Debug, Serialize)]
pub struct OutageReportItem {
    pub id: i64,
    pub outage_type: String,
    pub target: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub start_error: Option<String>,
    pub end_note: Option<String>,
    pub duration_seconds: Option<i64>,
    pub status: String,
}
