mod common;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::{
    api, db,
    models::WifiObservation,
    monitors::connectivity::ProbeResult,
    services::{self, alerts::evaluate_dns},
};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]

async fn alert_opens_and_resolves() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet",
        "https://google.com",
        "internet check failed: timeout",
        true,
        Utc::now(),
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "info",
        "internet",
        "https://google.com",
        "internet recovered",
        false,
        Utc::now(),
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert!(!alerts[0].is_active);
    assert!(alerts[0].resolved_at.is_some());
    assert!(alerts[0].acknowledged_at.is_none());

    Ok(())
}

#[tokio::test]
async fn connectivity_alert_opens_as_warning_after_two_failures() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let target = "https://www.google.com/generate_204";
    let t1 = Utc::now();
    let t2 = t1 + Duration::seconds(30);

    let failed_probe = ProbeResult {
        success: false,
        latency_ms: None,
        error_message: Some("timeout".to_string()),
    };

    db::insert_connectivity_check(
        &harness.state.db,
        t1,
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    services::alerts::evaluate_connectivity(&harness.state, "internet_http", target, &failed_probe)
        .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 0);

    db::insert_connectivity_check(
        &harness.state.db,
        t2,
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    services::alerts::evaluate_connectivity(&harness.state, "internet_http", target, &failed_probe)
        .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);
    assert_eq!(alerts[0].severity, "warning");

    Ok(())
}

#[tokio::test]
async fn connectivity_alert_escalates_to_critical_after_outage_age_threshold() -> anyhow::Result<()>
{
    let harness = TestHarness::new().await?;
    let target = "https://www.google.com/generate_204";
    let now = Utc::now();
    let started_at = now - Duration::minutes(6);

    let failed_probe = ProbeResult {
        success: false,
        latency_ms: None,
        error_message: Some("timeout".to_string()),
    };

    db::insert_connectivity_check(
        &harness.state.db,
        started_at,
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    db::insert_connectivity_check(
        &harness.state.db,
        started_at + Duration::seconds(30),
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    services::alerts::evaluate_connectivity(&harness.state, "internet_http", target, &failed_probe)
        .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert_eq!(alerts[0].severity, "critical");
    assert!(alerts[0].message.contains("still failing"));

    Ok(())
}

#[tokio::test]
async fn connectivity_alert_resolves_only_after_two_successes() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let target = "https://www.google.com/generate_204";
    let now = Utc::now();

    let failed_probe = ProbeResult {
        success: false,
        latency_ms: None,
        error_message: Some("timeout".to_string()),
    };

    let success_probe = ProbeResult {
        success: true,
        latency_ms: Some(12.0),
        error_message: None,
    };

    db::insert_connectivity_check(
        &harness.state.db,
        now,
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    db::insert_connectivity_check(
        &harness.state.db,
        now + Duration::seconds(30),
        target,
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    services::alerts::evaluate_connectivity(&harness.state, "internet_http", target, &failed_probe)
        .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);

    db::insert_connectivity_check(
        &harness.state.db,
        now + Duration::minutes(1),
        target,
        "internet",
        "internet_http",
        true,
        Some(12.0),
        None,
    )
    .await?;
    services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &success_probe,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert!(alerts[0].is_active);

    db::insert_connectivity_check(
        &harness.state.db,
        now + Duration::minutes(1) + Duration::seconds(30),
        target,
        "internet",
        "internet_http",
        true,
        Some(11.0),
        None,
    )
    .await?;
    services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &success_probe,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert!(!alerts[0].is_active);
    assert!(alerts[0].resolved_at.is_some());

    Ok(())
}

#[tokio::test]
async fn dns_alert_opens_as_warning_after_two_failures() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let domain = "google.com";
    let t1 = Utc::now();
    let t2 = t1 + Duration::seconds(30);

    db::insert_dns_check(
        &harness.state.db,
        t1,
        domain,
        "1.1.1.1",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    evaluate_dns(&harness.state, domain, false, Some("timeout")).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 0);

    db::insert_dns_check(
        &harness.state.db,
        t2,
        domain,
        "1.1.1.1",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    evaluate_dns(&harness.state, domain, false, Some("timeout")).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);
    assert_eq!(alerts[0].severity, "warning");

    Ok(())
}

#[tokio::test]
async fn enriched_devices_include_labels_and_gateway_flag() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    db::upsert_device(
        &harness.state.db,
        "192.168.1.1",
        Some("aa:bb:cc:dd:ee:ff"),
        Some("router-host"),
        Utc::now(),
    )
    .await?;

    let enriched = services::devices::list_enriched(&harness.state).await?;
    let router = enriched
        .iter()
        .find(|d| d.ip_address == "192.168.1.1")
        .unwrap();

    assert!(router.is_gateway);
    assert!(router.is_known);
    assert_eq!(router.label.as_deref(), Some("Router"));
    assert_eq!(router.display_name, "Router");

    Ok(())
}

#[tokio::test]
async fn acknowledge_active_alert_sets_acknowledged_at() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet",
        "https://www.google.com/generate_204",
        "internet check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].acknowledged_at.is_none());

    let acknowledged =
        db::acknowledge_alert(&harness.state.db, alerts[0].id, now + Duration::seconds(10)).await?;

    assert!(acknowledged.is_some());
    assert!(acknowledged.unwrap().acknowledged_at.is_some());

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert!(alerts[0].acknowledged_at.is_some());
    assert!(alerts[0].is_active);

    Ok(())
}

#[tokio::test]
async fn acknowledging_unknown_alert_returns_none() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let acknowledged = db::acknowledge_alert(&harness.state.db, 999_999, Utc::now()).await?;

    assert!(acknowledged.is_none());

    Ok(())
}

#[tokio::test]
async fn alert_update_clears_acknowledged_at() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    let acknowledged =
        db::acknowledge_alert(&harness.state.db, alert_id, now + Duration::seconds(5)).await?;
    assert!(acknowledged.unwrap().acknowledged_at.is_some());

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http still failing after 5m: timeout",
        true,
        now + Duration::minutes(5),
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert_eq!(alerts[0].severity, "critical");
    assert!(alerts[0].acknowledged_at.is_none());

    Ok(())
}

#[tokio::test]
async fn alert_history_records_opened_and_resolved() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);

    let history = db::list_alert_history(&harness.state.db, alerts[0].id, 20).await?;
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].event_type, "opened");
    assert_eq!(history[0].previous_value, None);
    assert_eq!(history[0].new_value.as_deref(), Some("warning"));

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "info",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http recovered",
        false,
        now + Duration::minutes(1),
    )
    .await?;

    let history = db::list_alert_history(&harness.state.db, alerts[0].id, 20).await?;
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].event_type, "resolved");
    assert_eq!(history[0].previous_value.as_deref(), Some("active"));
    assert_eq!(history[0].new_value.as_deref(), Some("resolved"));

    Ok(())
}

#[tokio::test]
async fn alert_history_records_acknowledged_event() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet",
        "https://www.google.com/generate_204",
        "internet check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    db::acknowledge_alert(&harness.state.db, alert_id, now + Duration::seconds(10)).await?;

    let history = db::list_alert_history(&harness.state.db, alert_id, 20).await?;
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].event_type, "acknowledged");
    assert_eq!(history[0].new_value.as_deref(), Some("acknowledged"));

    Ok(())
}

#[tokio::test]
async fn alert_history_records_severity_and_message_changes() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http still failing after 5m: timeout",
        true,
        now + Duration::minutes(5),
    )
    .await?;

    let history = db::list_alert_history(&harness.state.db, alert_id, 20).await?;
    assert_eq!(history.len(), 3);

    assert_eq!(history[0].event_type, "message_changed");
    assert_eq!(
        history[0].previous_value.as_deref(),
        Some("internet_http check failed: timeout")
    );
    assert_eq!(
        history[0].new_value.as_deref(),
        Some("internet_http still failing after 5m: timeout")
    );

    assert_eq!(history[1].event_type, "severity_changed");
    assert_eq!(history[1].previous_value.as_deref(), Some("warning"));
    assert_eq!(history[1].new_value.as_deref(), Some("critical"));

    assert_eq!(history[2].event_type, "opened");

    Ok(())
}

#[tokio::test]
async fn acknowledge_alert_api_returns_200_and_sets_acknowledged_at() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet",
        "https://www.google.com/generate_204",
        "internet check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/alerts/{alert_id}/acknowledge"))
                .body(Body::from("{}"))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["id"].as_i64(), Some(alert_id));
    assert_eq!(json["is_active"].as_bool(), Some(true));
    assert!(json["acknowledged_at"].as_str().is_some());

    Ok(())
}

#[tokio::test]
async fn acknowledge_alert_api_returns_404_for_unknown_alert() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/alerts/999999/acknowledge")
                .body(Body::from("{}"))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    assert_eq!(json["error"].as_str(), Some("alert not found"));

    Ok(())
}

#[tokio::test]
async fn alert_history_api_returns_lifecycle_events() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    db::acknowledge_alert(&harness.state.db, alert_id, now + Duration::seconds(10)).await?;

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http still failing after 5m: timeout",
        true,
        now + Duration::minutes(5),
    )
    .await?;

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "info",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http recovered",
        false,
        now + Duration::minutes(6),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/alerts/{alert_id}/history"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    let items = json
        .as_array()
        .expect("history response should be an array");

    assert!(!items.is_empty());

    let event_types: Vec<&str> = items
        .iter()
        .filter_map(|item| item["event_type"].as_str())
        .collect();
    assert!(event_types.contains(&"opened"));
    assert!(event_types.contains(&"acknowledged"));
    assert!(event_types.contains(&"severity_changed"));
    assert!(event_types.contains(&"message_changed"));
    assert!(event_types.contains(&"resolved"));

    Ok(())
}

#[tokio::test]
async fn alert_history_api_returns_opened_for_new_alert() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "warning",
        "internet_http",
        "https://www.google.com/generate_204",
        "internet_http check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/alerts/{alert_id}/history"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    let items = json
        .as_array()
        .expect("history response should be an array");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["event_type"].as_str(), Some("opened"));
    assert_eq!(items[0]["new_value"].as_str(), Some("warning"));

    Ok(())
}

#[tokio::test]
async fn acknowledging_alert_twice_does_not_duplicate_history() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::upsert_alert_state(
        &harness.state.db,
        "service_health",
        "critical",
        "internet",
        "https://www.google.com/generate_204",
        "internet check failed: timeout",
        true,
        now,
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let alert_id = alerts[0].id;

    let first =
        db::acknowledge_alert(&harness.state.db, alert_id, now + Duration::seconds(10)).await?;
    let first_ack_at = first
        .as_ref()
        .and_then(|alert| alert.acknowledged_at)
        .expect("first acknowledge should set acknowledged_at");

    let second =
        db::acknowledge_alert(&harness.state.db, alert_id, now + Duration::seconds(20)).await?;
    let second_ack_at = second
        .as_ref()
        .and_then(|alert| alert.acknowledged_at)
        .expect("second acknowledge should keep acknowledged_at");

    assert_eq!(first_ack_at, second_ack_at);

    let history = db::list_alert_history(&harness.state.db, alert_id, 20).await?;
    let acknowledged_events = history
        .iter()
        .filter(|item| item.event_type == "acknowledged")
        .count();

    assert_eq!(acknowledged_events, 1);

    Ok(())
}

#[tokio::test]
async fn alert_history_api_returns_404_for_unknown_alert() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/alerts/999999/history")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    assert_eq!(json["error"].as_str(), Some("alert not found"));

    Ok(())
}

#[tokio::test]
async fn wifi_signal_alert_opens_as_warning() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let observation = WifiObservation {
        module: "home_network".to_string(),
        collector_type: "wifi_sampling".to_string(),
        entity_type: "wifi".to_string(),
        entity_key: "office".to_string(),
        location_label: "office".to_string(),
        interface_name: "wlo1".to_string(),
        ssid: Some("TestWifi".to_string()),
        bssid: None,
        rssi_dbm: Some(-72),
        frequency_mhz: Some(5180),
        band: Some("5ghz".to_string()),
        observed_at: Utc::now(),
    };

    services::alerts::evaluate_wifi_observation(&harness.state, &observation).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;

    assert_eq!(alerts.len(), 1);
    assert_eq!(alerts[0].alert_type, "wifi_signal_weak");
    assert_eq!(alerts[0].severity, "warning");
    assert_eq!(alerts[0].entity_type, "wifi");
    assert_eq!(alerts[0].entity_key, "office");

    Ok(())
}
