mod common;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::Utc;
use serde_json::Value;
use tower::ServiceExt;

use common::TestHarness;
use lag_rat_backend::{api, db};

#[tokio::test]
async fn clear_observations_rejects_wrong_confirmation() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/maintenance/clear-observations")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "confirmation": "DELETE EVERYTHING"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    Ok(())
}

#[tokio::test]
async fn clear_observations_clears_runtime_tables_but_keeps_known_devices() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    db::insert_connectivity_check(
        &harness.state.db,
        Utc::now(),
        "https://example.com",
        "internet",
        "internet_http",
        true,
        Some(20.0),
        None,
    )
    .await?;

    db::insert_dns_check(
        &harness.state.db,
        Utc::now(),
        "example.com",
        "1.1.1.1",
        true,
        Some(12.0),
        None,
    )
    .await?;

    db::insert_wifi_sample(
        &harness.state.db,
        "office",
        "wlo1",
        Some("Test WiFi"),
        None,
        Some(-50),
        Some(2412),
        Some("2.4 GHz"),
        Utc::now(),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "wlo1",
        "device",
        "192.168.1.20",
        Some("192.168.1.20"),
        Some("aa:bb:cc:dd:ee:ff"),
        1000,
        2000,
        Some(10),
        Some(20),
        Utc::now(),
    )
    .await?;

    db::create_capture_export_request(
        &harness.state.db,
        &lag_rat_backend::models::CreateCaptureExportRequest {
            source: "device_detail".to_string(),
            interface_name: Some("wlo1".to_string()),
            entity_type: Some("device".to_string()),
            entity_key: Some("192.168.1.20".to_string()),
            device_ip_address: Some("192.168.1.20".to_string()),
            mac_address: Some("aa:bb:cc:dd:ee:ff".to_string()),
            window_minutes: Some(60),
            note: Some("Test capture request".to_string()),
        },
        Utc::now(),
    )
    .await?;

    let known_before = db::list_known_devices(&harness.state.db).await?;
    assert!(!known_before.is_empty());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/maintenance/clear-observations")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "confirmation": "CLEAR OBSERVATIONS"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["cleared"].as_bool(), Some(true));
    assert_eq!(json["capture_files_deleted"].as_u64(), Some(0));
    assert!(json["total_deleted_rows"].as_u64().unwrap_or(0) >= 5);

    let tables = json["tables"]
        .as_array()
        .expect("tables should be an array");

    assert!(tables
        .iter()
        .any(|item| item["table"].as_str() == Some("connectivity_checks")));
    assert!(tables
        .iter()
        .any(|item| item["table"].as_str() == Some("dns_checks")));
    assert!(tables
        .iter()
        .any(|item| item["table"].as_str() == Some("wifi_samples")));
    assert!(tables
        .iter()
        .any(|item| item["table"].as_str() == Some("traffic_samples")));
    assert!(tables
        .iter()
        .any(|item| item["table"].as_str() == Some("capture_export_requests")));

    let known_after = db::list_known_devices(&harness.state.db).await?;
    assert_eq!(known_after.len(), known_before.len());

    let capture_requests = db::list_capture_export_requests(&harness.state.db, 20).await?;
    assert!(capture_requests.is_empty());

    Ok(())
}

#[tokio::test]
async fn clear_observations_deletes_lag_rat_capture_files_only() -> anyhow::Result<()> {
    let mut harness = TestHarness::new().await?;

    let capture_dir = harness.root.join("test-captures");
    harness.state.config.capture.output_dir = capture_dir.to_string_lossy().to_string();

    tokio::fs::create_dir_all(&capture_dir).await?;

    let capture_file = capture_dir.join("capture-99-20260510T074424Z.pcap");
    let non_capture_file = capture_dir.join("notes.txt");

    tokio::fs::write(&capture_file, b"pcap").await?;
    tokio::fs::write(&non_capture_file, b"keep me").await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/maintenance/clear-observations")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "confirmation": "CLEAR OBSERVATIONS"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["capture_files_deleted"].as_u64(), Some(1));
    assert!(!capture_file.exists());
    assert!(non_capture_file.exists());

    Ok(())
}
