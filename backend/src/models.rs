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
    pub probe_kind: Option<String>,
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
pub struct ReportSummaryResponse {
    pub window_hours: u32,
    pub uptime_pct: f64,
    pub avg_latency_ms: f64,
    pub outage_count: u32,
    pub total_downtime_seconds: i64,
    pub dns_failure_count: u32,
    pub device_history_event_count: u32,
    pub active_alert_count: u32,
    pub active_critical_alert_count: u32,
    pub active_unacknowledged_alert_count: u32,
}

#[derive(Debug, Serialize)]
pub struct ReportSnapshotResponse {
    pub generated_at: DateTime<Utc>,
    pub window_hours: u32,
    pub narrative: String,
    pub summary: ReportSummaryResponse,
    pub top_incident_targets: Vec<IncidentTargetSummaryItem>,
    pub recent_alert_events: Vec<RecentAlertEventItem>,
    pub recent_device_events: Vec<RecentDeviceEventItem>,
    pub outages: Vec<OutageReportItem>,
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
pub struct AlertOverview {
    pub active_count: u32,
    pub active_critical_count: u32,
    pub active_unacknowledged_count: u32,
    pub active_unacknowledged_critical_count: u32,
    pub most_recent_created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct StatusOverviewResponse {
    pub checked_at: DateTime<Utc>,
    pub router: ServiceStatus,
    pub internet: ServiceStatus,
    pub internet_tcp: ServiceStatus,
    pub internet_http: ServiceStatus,
    pub dns: DnsStatus,
    pub devices: DeviceOverview,
    pub outages: OutageOverview,
    pub alerts: AlertOverview,
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
pub struct KnownDevice {
    pub id: i64,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub label: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct Alert {
    pub id: i64,
    pub alert_type: String,
    pub severity: String,
    pub entity_type: String,
    pub entity_key: String,
    pub message: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
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

#[derive(Debug, serde::Serialize)]
pub struct OutageReportItem {
    pub id: i64,
    pub outage_type: String,
    pub target: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_active: bool,
    pub start_error: Option<String>,
    pub end_note: Option<String>,
    pub duration_seconds: Option<i64>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct EnrichedDevice {
    pub id: i64,
    pub ip_address: String,
    pub mac_address: Option<String>,
    pub hostname: Option<String>,
    pub display_name: String,
    pub label: Option<String>,
    pub notes: Option<String>,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub is_recent: bool,
    pub is_gateway: bool,
    pub is_this_device: bool,
    pub is_known: bool,
    pub confidence: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct SaveKnownDeviceRequest {
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub label: String,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct KnownDeviceView {
    pub id: i64,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub label: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct DeviceHistoryEvent {
    pub id: i64,
    pub device_ip_address: String,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DeviceHistoryItem {
    pub id: i64,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct AlertHistoryEvent {
    pub id: i64,
    pub alert_id: i64,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AlertHistoryItem {
    pub id: i64,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RecentAlertEventItem {
    pub alert_id: i64,
    pub alert_type: String,
    pub severity: String,
    pub entity_type: String,
    pub entity_key: String,
    pub message: String,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RecentDeviceEventItem {
    pub device_ip_address: String,
    pub event_type: String,
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct IncidentTargetSummaryItem {
    pub incident_type: String,
    pub target: String,
    pub count: u32,
    pub active_count: u32,
    pub total_downtime_seconds: i64,
    pub latest_started_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ReportTrendPoint {
    pub bucket_start: DateTime<Utc>,
    pub label: String,
    pub outage_count: u32,
    pub dns_failure_count: u32,
    pub internet_http_failure_count: u32,
    pub internet_tcp_failure_count: u32,
}

#[derive(Debug, Serialize)]
pub struct ProbeMetricsSummaryItem {
    pub key: String,
    pub label: String,
    pub total_checks: u32,
    pub success_count: u32,
    pub failure_count: u32,
    pub success_rate_pct: f64,
    pub avg_latency_ms: f64,
    pub latest_latency_ms: Option<f64>,
    pub last_checked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct MetricsSummaryResponse {
    pub window_minutes: u32,
    pub items: Vec<ProbeMetricsSummaryItem>,
}

#[derive(Debug, Clone)]
pub enum CollectorObservation {
    Connectivity(ServiceObservation),
    Dns(DnsObservation),
}

#[derive(Debug, Clone)]
pub struct ServiceObservation {
    pub module: String,
    pub collector_type: String,
    pub target: String,
    pub target_type: String,
    pub entity_type: String,
    pub entity_key: String,
    pub observed_at: DateTime<Utc>,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DnsObservation {
    pub module: String,
    pub collector_type: String,
    pub domain: String,
    pub resolver: String,
    pub entity_type: &'static str,
    pub entity_key: String,
    pub observed_at: DateTime<Utc>,
    pub success: bool,
    pub response_time_ms: Option<f64>,
    pub error_message: Option<String>,
}
