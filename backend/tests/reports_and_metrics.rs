mod common;

use std::collections::HashMap;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::{
    api::router,
    db::{
        acknowledge_alert, insert_connectivity_check, insert_device_history_event,
        insert_dns_check, list_alerts_filtered, upsert_alert_state,
    },
};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn reports_summary_api_aggregates_window_counts() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    // internet_http checks: 3 successes, 1 failure => 75% uptime
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(110),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(20.0),
        None,
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(100),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(30.0),
        None,
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(90),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(80),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(10.0),
        None,
    )
    .await?;

    // Close the internet_http outage after 10 minutes.
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(79),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(11.0),
        None,
    )
    .await?;

    // One DNS failure opens an active DNS outage.
    insert_dns_check(
        &harness.state.db,
        now - Duration::minutes(30),
        "google.com",
        "1.1.1.1",
        false,
        None,
        Some("dns timeout"),
    )
    .await?;

    // Device history inside the window.
    insert_device_history_event(
        &harness.state.db,
        "192.168.1.20",
        "first_seen",
        None,
        Some("phone"),
        now - Duration::minutes(40),
    )
    .await?;
    insert_device_history_event(
        &harness.state.db,
        "192.168.1.21",
        "seen_again",
        None,
        None,
        now - Duration::minutes(20),
    )
    .await?;

    // Two active alerts: one acknowledged critical, one unacknowledged warning.
    upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http still failing",
        true,
        now - Duration::minutes(50),
    )
    .await?;

    let alerts = list_alerts_filtered(&harness.state.db, None, None, None, None, 20).await?;
    let internet_alert_id = alerts
        .iter()
        .find(|a| a.entity_type == "internet_http")
        .map(|a| a.id)
        .expect("internet_http alert should exist");

    acknowledge_alert(
        &harness.state.db,
        internet_alert_id,
        now - Duration::minutes(45),
    )
    .await?;

    upsert_alert_state(
        &harness.state.db,
        "dns_health",
        "warning",
        "dns",
        "google.com",
        "dns resolution failing",
        true,
        now - Duration::minutes(25),
    )
    .await?;

    let app = router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/summary?hours=2")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_hours"].as_u64(), Some(2));
    assert_eq!(json["outage_count"].as_u64(), Some(2));
    assert_eq!(json["dns_failure_count"].as_u64(), Some(1));
    assert_eq!(json["device_history_event_count"].as_u64(), Some(2));
    assert_eq!(json["active_alert_count"].as_u64(), Some(2));
    assert_eq!(json["active_critical_alert_count"].as_u64(), Some(1));
    assert_eq!(json["active_unacknowledged_alert_count"].as_u64(), Some(1));

    let uptime = json["uptime_pct"]
        .as_f64()
        .expect("uptime_pct should be a number");
    assert!((uptime - 80.0).abs() < 0.001);

    let avg_latency = json["avg_latency_ms"]
        .as_f64()
        .expect("avg_latency_ms should be a number");
    assert!((avg_latency - 17.75).abs() < 0.001);

    let downtime = json["total_downtime_seconds"]
        .as_i64()
        .expect("total_downtime_seconds should be an integer");
    assert!(downtime >= 60);

    Ok(())
}

#[tokio::test]
async fn metrics_summary_api_returns_expected_probe_items() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    // HTTP: 2 successes, 1 failure
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(50),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(20.0),
        None,
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(40),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(30),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(10.0),
        None,
    )
    .await?;

    // TCP: 1 success
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(25),
        "1.1.1.1:443",
        "internet",
        "internet_tcp",
        true,
        Some(12.0),
        None,
    )
    .await?;

    // DNS: 1 success, 1 failure
    insert_dns_check(
        &harness.state.db,
        now - Duration::minutes(20),
        "google.com",
        "1.1.1.1",
        true,
        Some(18.0),
        None,
    )
    .await?;
    insert_dns_check(
        &harness.state.db,
        now - Duration::minutes(10),
        "google.com",
        "1.1.1.1",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    let app = router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/metrics/summary?minutes=120")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_minutes"].as_u64(), Some(120));

    let items = json["items"].as_array().expect("items should be an array");

    assert_eq!(items.len(), 3);

    let mut by_key: HashMap<String, &Value> = HashMap::new();
    for item in items {
        let key = item["key"]
            .as_str()
            .expect("item.key should be a string")
            .to_string();
        by_key.insert(key, item);
    }

    let http = by_key
        .get("internet_http")
        .expect("internet_http summary should exist");
    assert_eq!(http["total_checks"].as_u64(), Some(3));
    assert_eq!(http["success_count"].as_u64(), Some(2));
    assert_eq!(http["failure_count"].as_u64(), Some(1));
    assert!(http["last_checked_at"].as_str().is_some());
    assert_eq!(http["latest_latency_ms"].as_f64(), Some(10.0));

    let tcp = by_key
        .get("internet_tcp")
        .expect("internet_tcp summary should exist");
    assert_eq!(tcp["total_checks"].as_u64(), Some(1));
    assert_eq!(tcp["success_count"].as_u64(), Some(1));
    assert_eq!(tcp["failure_count"].as_u64(), Some(0));
    assert_eq!(tcp["latest_latency_ms"].as_f64(), Some(12.0));

    let dns = by_key.get("dns").expect("dns summary should exist");
    assert_eq!(dns["total_checks"].as_u64(), Some(2));
    assert_eq!(dns["success_count"].as_u64(), Some(1));
    assert_eq!(dns["failure_count"].as_u64(), Some(1));
    assert!(dns["last_checked_at"].as_str().is_some());
    assert!(dns["latest_latency_ms"].is_null() || dns["latest_latency_ms"].as_f64().is_some());

    Ok(())
}

#[tokio::test]
async fn reports_trends_api_buckets_failures_and_outages() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(20),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(18),
        "1.1.1.1:443",
        "internet",
        "internet_tcp",
        false,
        None,
        Some("tcp timeout"),
    )
    .await?;

    insert_dns_check(
        &harness.state.db,
        now - Duration::minutes(15),
        "google.com",
        "1.1.1.1",
        false,
        None,
        Some("dns timeout"),
    )
    .await?;

    let app = router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/trends?hours=24")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    let items = json.as_array().expect("trends response should be an array");
    assert_eq!(items.len(), 24);

    let outage_total: u64 = items
        .iter()
        .map(|item| item["outage_count"].as_u64().unwrap_or(0))
        .sum();
    let dns_failure_total: u64 = items
        .iter()
        .map(|item| item["dns_failure_count"].as_u64().unwrap_or(0))
        .sum();
    let http_failure_total: u64 = items
        .iter()
        .map(|item| item["internet_http_failure_count"].as_u64().unwrap_or(0))
        .sum();
    let tcp_failure_total: u64 = items
        .iter()
        .map(|item| item["internet_tcp_failure_count"].as_u64().unwrap_or(0))
        .sum();

    assert_eq!(outage_total, 3);
    assert_eq!(dns_failure_total, 1);
    assert_eq!(http_failure_total, 1);
    assert_eq!(tcp_failure_total, 1);

    Ok(())
}

#[tokio::test]
async fn reports_snapshot_api_returns_composed_sections() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(70),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(60),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(15.0),
        None,
    )
    .await?;

    insert_dns_check(
        &harness.state.db,
        now - Duration::minutes(30),
        "google.com",
        "1.1.1.1",
        false,
        None,
        Some("dns timeout"),
    )
    .await?;

    insert_device_history_event(
        &harness.state.db,
        "192.168.1.30",
        "first_seen",
        None,
        Some("laptop"),
        now - Duration::minutes(25),
    )
    .await?;

    upsert_alert_state(
        &harness.state.db,
        "dns_health",
        "critical",
        "dns",
        "google.com",
        "dns resolution failed",
        true,
        now - Duration::minutes(20),
    )
    .await?;

    let alerts = list_alerts_filtered(&harness.state.db, None, None, None, None, 20).await?;
    let alert_id = alerts[0].id;

    acknowledge_alert(&harness.state.db, alert_id, now - Duration::minutes(10)).await?;

    let app = router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/snapshot?hours=24")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_hours"].as_u64(), Some(24));
    assert!(json["generated_at"].as_str().is_some());

    let narrative = json["narrative"]
        .as_str()
        .expect("snapshot narrative should be a string");
    assert!(narrative.contains("Network uptime was"));
    assert!(narrative.contains("DNS failures occurred"));
    assert!(narrative.contains("active alerts"));

    assert!(json["summary"].is_object());
    assert!(json["top_incident_targets"].is_array());
    assert!(json["recent_alert_events"].is_array());
    assert!(json["recent_device_events"].is_array());
    assert!(json["outages"].is_array());

    let recent_alert_events = json["recent_alert_events"]
        .as_array()
        .expect("recent_alert_events should be an array");
    assert!(!recent_alert_events.is_empty());

    let recent_device_events = json["recent_device_events"]
        .as_array()
        .expect("recent_device_events should be an array");
    assert!(!recent_device_events.is_empty());

    let outages = json["outages"]
        .as_array()
        .expect("outages should be an array");
    assert!(!outages.is_empty());

    Ok(())
}

#[tokio::test]
async fn recent_reports_endpoints_and_top_incidents_return_windowed_items() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(40),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(20),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(12.0),
        None,
    )
    .await?;

    insert_device_history_event(
        &harness.state.db,
        "192.168.1.40",
        "label_added",
        None,
        Some("Printer"),
        now - Duration::minutes(15),
    )
    .await?;

    upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now - Duration::minutes(35),
    )
    .await?;

    let alerts = list_alerts_filtered(&harness.state.db, None, None, None, None, 20).await?;
    let alert_id = alerts[0].id;

    acknowledge_alert(&harness.state.db, alert_id, now - Duration::minutes(30)).await?;

    let app = router(harness.state.clone());

    let recent_alerts_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/alerts/recent?hours=24")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(recent_alerts_response.status(), StatusCode::OK);

    let recent_alerts_body = to_bytes(recent_alerts_response.into_body(), usize::MAX).await?;
    let recent_alerts_json: Value = serde_json::from_slice(&recent_alerts_body)?;
    let recent_alerts_items = recent_alerts_json
        .as_array()
        .expect("recent alert events should be an array");
    assert!(!recent_alerts_items.is_empty());

    let recent_devices_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/devices/recent?hours=24")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(recent_devices_response.status(), StatusCode::OK);

    let recent_devices_body = to_bytes(recent_devices_response.into_body(), usize::MAX).await?;
    let recent_devices_json: Value = serde_json::from_slice(&recent_devices_body)?;
    let recent_devices_items = recent_devices_json
        .as_array()
        .expect("recent device events should be an array");
    assert!(!recent_devices_items.is_empty());

    let top_incidents_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/reports/incidents/top?hours=24")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(top_incidents_response.status(), StatusCode::OK);

    let top_incidents_body = to_bytes(top_incidents_response.into_body(), usize::MAX).await?;
    let top_incidents_json: Value = serde_json::from_slice(&top_incidents_body)?;
    let top_incidents_items = top_incidents_json
        .as_array()
        .expect("top incidents should be an array");
    assert!(!top_incidents_items.is_empty());

    let top = &top_incidents_items[0];
    assert_eq!(
        top["target"].as_str(),
        Some("https://www.google.com/generate_204")
    );
    assert!(top["count"].as_u64().unwrap_or(0) >= 1);

    Ok(())
}
