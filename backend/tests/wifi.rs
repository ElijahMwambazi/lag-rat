mod common;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::{api, db, models::WifiObservation, services};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn wifi_samples_can_be_inserted_and_listed_newest_first() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-48),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(1),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-44),
        Some(5180),
        Some("5ghz"),
        now,
    )
    .await?;

    let samples =
        lag_rat_backend::db::list_wifi_samples_filtered(&harness.state.db, 60, None, 10).await?;
    assert_eq!(samples.len(), 2);
    assert_eq!(samples[0].rssi_dbm, Some(-44));
    assert_eq!(samples[1].rssi_dbm, Some(-48));

    Ok(())
}

#[tokio::test]
async fn latest_wifi_sample_returns_newest_sample() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-61),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-43),
        Some(5180),
        Some("5ghz"),
        now,
    )
    .await?;

    let latest = db::latest_wifi_sample(&harness.state.db).await?;
    let latest = latest.expect("latest wifi sample should exist");

    assert_eq!(latest.location_label, "office");
    assert_eq!(latest.rssi_dbm, Some(-43));

    Ok(())
}

#[tokio::test]
async fn wifi_samples_api_returns_samples_in_descending_time_order() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(1),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-47),
        Some(5180),
        Some("5ghz"),
        now,
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/samples?limit=10")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    let items = json
        .as_array()
        .expect("wifi samples response should be an array");

    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["rssi_dbm"].as_i64(), Some(-47));
    assert_eq!(items[1]["rssi_dbm"].as_i64(), Some(-55));

    Ok(())
}

#[tokio::test]
async fn wifi_latest_api_returns_latest_sample() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-60),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(3),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("LagRatNet"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-42),
        Some(5180),
        Some("5ghz"),
        now,
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/latest")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["location_label"].as_str(), Some("office"));
    assert_eq!(json["band"].as_str(), Some("5ghz"));
    assert_eq!(json["rssi_dbm"].as_i64(), Some(-42));

    Ok(())
}

#[tokio::test]
async fn wifi_latest_api_returns_404_when_empty() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/latest")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    assert_eq!(json["error"].as_str(), Some("wifi sample not found"));

    Ok(())
}

#[tokio::test]
async fn wifi_signal_alert_resolves_after_recovery() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let weak_observation = WifiObservation {
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

    services::alerts::evaluate_wifi_observation(&harness.state, &weak_observation).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);
    let alert_id = alerts[0].id;

    let recovered_observation = WifiObservation {
        rssi_dbm: Some(-58),
        observed_at: Utc::now(),
        ..weak_observation.clone()
    };

    services::alerts::evaluate_wifi_observation(&harness.state, &recovered_observation).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(!alerts[0].is_active);
    assert!(alerts[0].resolved_at.is_some());
    assert_eq!(alerts[0].alert_type, "wifi_signal_weak");

    let history = db::list_alert_history(&harness.state.db, alert_id, 20).await?;
    assert!(history.iter().any(|item| item.event_type == "resolved"));

    Ok(())
}

#[tokio::test]
async fn wifi_signal_alert_escalates_from_warning_to_critical() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let warning_observation = WifiObservation {
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

    services::alerts::evaluate_wifi_observation(&harness.state, &warning_observation).await?;

    let critical_observation = WifiObservation {
        rssi_dbm: Some(-85),
        observed_at: Utc::now(),
        ..warning_observation.clone()
    };

    services::alerts::evaluate_wifi_observation(&harness.state, &critical_observation).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);
    assert_eq!(alerts[0].alert_type, "wifi_signal_weak");
    assert_eq!(alerts[0].severity, "critical");

    let history = db::list_alert_history(&harness.state.db, alerts[0].id, 20).await?;
    assert!(history
        .iter()
        .any(|item| item.event_type == "severity_changed"));

    Ok(())
}

#[tokio::test]
async fn wifi_stale_alert_opens_and_resolves_after_fresh_sample() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("TestWifi"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-62),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(20),
    )
    .await?;

    services::alerts::evaluate_wifi_sample_freshness(&harness.state, "office").await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let stale_alert = alerts
        .iter()
        .find(|alert| alert.alert_type == "wifi_samples_stale")
        .expect("wifi stale alert should exist");

    assert!(stale_alert.is_active);
    let alert_id = stale_alert.id;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("TestWifi"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-58),
        Some(5180),
        Some("5ghz"),
        now,
    )
    .await?;

    services::alerts::evaluate_wifi_sample_freshness(&harness.state, "office").await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let stale_alert = alerts
        .iter()
        .find(|alert| alert.alert_type == "wifi_samples_stale")
        .expect("wifi stale alert should still exist");

    assert!(!stale_alert.is_active);
    assert!(stale_alert.resolved_at.is_some());

    let history = db::list_alert_history(&harness.state.db, alert_id, 20).await?;
    assert!(history.iter().any(|item| item.event_type == "resolved"));

    Ok(())
}

#[tokio::test]
async fn evaluate_all_wifi_sample_freshness_only_flags_stale_rooms() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("TestWifi"),
        Some("aa:bb:cc:dd:ee:ff"),
        Some(-65),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(20),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("TestWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-59),
        Some(2412),
        Some("2.4ghz"),
        now,
    )
    .await?;

    services::alerts::evaluate_all_wifi_sample_freshness(&harness.state).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;

    let office_alert = alerts
        .iter()
        .find(|alert| alert.alert_type == "wifi_samples_stale" && alert.entity_key == "office")
        .expect("office stale alert should exist");

    assert!(office_alert.is_active);

    let bedroom_alert = alerts
        .iter()
        .find(|alert| alert.alert_type == "wifi_samples_stale" && alert.entity_key == "bedroom");

    assert!(bedroom_alert.is_none());

    Ok(())
}

#[tokio::test]
async fn wifi_signal_alert_does_not_duplicate_for_repeated_weak_samples() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let weak_observation = WifiObservation {
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

    services::alerts::evaluate_wifi_observation(&harness.state, &weak_observation).await?;
    services::alerts::evaluate_wifi_observation(&harness.state, &weak_observation).await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let wifi_alerts: Vec<_> = alerts
        .iter()
        .filter(|alert| {
            alert.alert_type == "wifi_signal_weak"
                && alert.entity_type == "wifi"
                && alert.entity_key == "office"
                && alert.is_active
        })
        .collect();

    assert_eq!(wifi_alerts.len(), 1);

    Ok(())
}

#[tokio::test]
async fn wifi_summary_filters_by_location_and_window() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-65),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-71),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(6),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-80),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(120),
    )
    .await?;

    let (latest, sample_count, avg_rssi_dbm, min_rssi_dbm, max_rssi_dbm) =
        db::wifi_summary(&harness.state.db, 60, Some("office")).await?;

    assert_eq!(sample_count, 2);
    assert_eq!(min_rssi_dbm, Some(-65));
    assert_eq!(max_rssi_dbm, Some(-55));
    assert_eq!(
        latest.as_ref().map(|item| item.location_label.as_str()),
        Some("office")
    );
    assert_eq!(latest.as_ref().and_then(|item| item.rssi_dbm), Some(-55));

    let avg = avg_rssi_dbm.expect("avg should exist");
    assert!((avg - (-60.0)).abs() < f64::EPSILON);

    Ok(())
}

#[tokio::test]
async fn wifi_summary_without_location_includes_all_recent_locations() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(7),
    )
    .await?;

    let (latest, sample_count, avg_rssi_dbm, min_rssi_dbm, max_rssi_dbm) =
        db::wifi_summary(&harness.state.db, 60, None).await?;

    assert_eq!(sample_count, 2);
    assert_eq!(min_rssi_dbm, Some(-70));
    assert_eq!(max_rssi_dbm, Some(-55));
    assert_eq!(
        latest.as_ref().map(|item| item.location_label.as_str()),
        Some("office")
    );
    assert_eq!(latest.as_ref().and_then(|item| item.rssi_dbm), Some(-55));

    let avg = avg_rssi_dbm.expect("avg should exist");
    assert!((avg - (-62.5)).abs() < f64::EPSILON);

    Ok(())
}

#[tokio::test]
async fn list_wifi_locations_returns_distinct_location_labels() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-60),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(3),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(4),
    )
    .await?;

    let mut locations = db::list_wifi_locations(&harness.state.db).await?;
    locations.sort();

    assert_eq!(locations, vec!["bedroom".to_string(), "office".to_string()]);

    Ok(())
}

#[tokio::test]
async fn wifi_location_summaries_return_per_location_rollups() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-65),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(6),
    )
    .await?;

    let mut items = db::wifi_location_summaries(&harness.state.db, 60).await?;
    items.sort_by(|a, b| a.0.cmp(&b.0));

    assert_eq!(items.len(), 2);

    let bedroom = &items[0];
    assert_eq!(bedroom.0, "bedroom");
    assert_eq!(bedroom.1.as_ref().and_then(|item| item.rssi_dbm), Some(-70));
    assert_eq!(bedroom.2, 1);
    assert_eq!(bedroom.3, Some(-70.0));
    assert_eq!(bedroom.4, Some(-70));
    assert_eq!(bedroom.5, Some(-70));

    let office = &items[1];
    assert_eq!(office.0, "office");
    assert_eq!(office.1.as_ref().and_then(|item| item.rssi_dbm), Some(-55));
    assert_eq!(office.2, 2);
    assert_eq!(office.3, Some(-60.0));
    assert_eq!(office.4, Some(-65));
    assert_eq!(office.5, Some(-55));

    Ok(())
}

#[tokio::test]
async fn latest_wifi_sample_for_location_returns_latest_for_requested_room() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-68),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(8),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-54),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(2),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlo1",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-72),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(1),
    )
    .await?;

    let office_latest = db::latest_wifi_sample_for_location(&harness.state.db, "office").await?;

    assert!(office_latest.is_some());
    assert_eq!(
        office_latest
            .as_ref()
            .map(|item| item.location_label.as_str()),
        Some("office")
    );
    assert_eq!(
        office_latest.as_ref().and_then(|item| item.rssi_dbm),
        Some(-54)
    );

    Ok(())
}

#[tokio::test]
async fn wifi_summary_api_returns_rollup_for_location_and_window() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-65),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-71),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(6),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-80),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(120),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/summary?minutes=60&location_label=office")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_minutes"].as_u64(), Some(60));
    assert_eq!(json["location_label"].as_str(), Some("office"));
    assert_eq!(json["sample_count"].as_u64(), Some(2));
    assert_eq!(json["min_rssi_dbm"].as_i64(), Some(-65));
    assert_eq!(json["max_rssi_dbm"].as_i64(), Some(-55));
    assert_eq!(
        json["latest_sample"]["location_label"].as_str(),
        Some("office")
    );
    assert_eq!(json["latest_sample"]["rssi_dbm"].as_i64(), Some(-55));

    let avg = json["avg_rssi_dbm"].as_f64().expect("avg should exist");
    assert!((avg - (-60.0)).abs() < f64::EPSILON);

    Ok(())
}

#[tokio::test]
async fn wifi_summary_api_returns_global_rollup_without_location_filter() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(7),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/summary?minutes=60")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_minutes"].as_u64(), Some(60));
    assert!(json["location_label"].is_null());
    assert_eq!(json["sample_count"].as_u64(), Some(2));
    assert_eq!(json["min_rssi_dbm"].as_i64(), Some(-70));
    assert_eq!(json["max_rssi_dbm"].as_i64(), Some(-55));
    assert_eq!(
        json["latest_sample"]["location_label"].as_str(),
        Some("office")
    );
    assert_eq!(json["latest_sample"]["rssi_dbm"].as_i64(), Some(-55));

    let avg = json["avg_rssi_dbm"].as_f64().expect("avg should exist");
    assert!((avg - (-62.5)).abs() < f64::EPSILON);

    Ok(())
}

#[tokio::test]
async fn wifi_locations_api_returns_distinct_labels() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-60),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(3),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(4),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/locations")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    let items = json["items"].as_array().expect("items should be an array");

    let mut labels: Vec<String> = items
        .iter()
        .filter_map(|item| item.as_str().map(ToString::to_string))
        .collect();

    labels.sort();

    assert_eq!(labels, vec!["bedroom".to_string(), "office".to_string()]);

    Ok(())
}

#[tokio::test]
async fn wifi_location_summaries_api_returns_per_room_items() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-65),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(6),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/locations/summary?minutes=60")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_minutes"].as_u64(), Some(60));

    let items = json["items"].as_array().expect("items should be an array");

    assert_eq!(items.len(), 2);

    let bedroom = items
        .iter()
        .find(|item| item["location_label"].as_str() == Some("bedroom"))
        .expect("bedroom summary should exist");

    assert_eq!(bedroom["sample_count"].as_u64(), Some(1));
    assert_eq!(bedroom["avg_rssi_dbm"].as_f64(), Some(-70.0));
    assert_eq!(bedroom["min_rssi_dbm"].as_i64(), Some(-70));
    assert_eq!(bedroom["max_rssi_dbm"].as_i64(), Some(-70));
    assert_eq!(bedroom["latest_sample"]["rssi_dbm"].as_i64(), Some(-70));

    let office = items
        .iter()
        .find(|item| item["location_label"].as_str() == Some("office"))
        .expect("office summary should exist");

    assert_eq!(office["sample_count"].as_u64(), Some(2));
    assert_eq!(office["avg_rssi_dbm"].as_f64(), Some(-60.0));
    assert_eq!(office["min_rssi_dbm"].as_i64(), Some(-65));
    assert_eq!(office["max_rssi_dbm"].as_i64(), Some(-55));
    assert_eq!(office["latest_sample"]["rssi_dbm"].as_i64(), Some(-55));

    Ok(())
}

#[tokio::test]
async fn wifi_samples_api_filters_by_location_label() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-55),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlan0",
        Some("OfficeWifi"),
        Some("aa:bb:cc:dd:ee:01"),
        Some(-47),
        Some(5180),
        Some("5ghz"),
        now - Duration::minutes(1),
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "bedroom",
        "wlan0",
        Some("BedroomWifi"),
        Some("aa:bb:cc:dd:ee:02"),
        Some(-70),
        Some(2412),
        Some("2.4ghz"),
        now - Duration::minutes(2),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/wifi/samples?minutes=60&location_label=office&limit=10")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;
    let items = json
        .as_array()
        .expect("wifi samples response should be an array");

    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["location_label"].as_str(), Some("office"));
    assert_eq!(items[1]["location_label"].as_str(), Some("office"));
    assert_eq!(items[0]["rssi_dbm"].as_i64(), Some(-47));
    assert_eq!(items[1]["rssi_dbm"].as_i64(), Some(-55));

    Ok(())
}
