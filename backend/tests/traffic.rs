use anyhow::Result;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use serde_json::Value;
use tower::ServiceExt;

use lag_rat_backend::{api, db, services::captures};

mod common;
use common::TestHarness;

#[tokio::test]
async fn traffic_samples_can_be_inserted_and_ranked() -> Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        1_000,
        2_000,
        Some(10),
        Some(20),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        5_000,
        8_000,
        Some(50),
        Some(80),
        now - Duration::minutes(1),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "wlan0",
        "interface",
        "wlan0",
        None,
        None,
        500,
        700,
        Some(5),
        Some(7),
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "wlan0",
        "interface",
        "wlan0",
        None,
        None,
        1_000,
        1_400,
        Some(10),
        Some(14),
        now - Duration::minutes(1),
    )
    .await?;

    let items = db::traffic_top_talkers(&harness.state.db, 60, 5).await?;

    assert_eq!(items.len(), 2);
    assert_eq!(items[0].interface_name, "eth0");
    assert_eq!(items[0].delta_bytes_total, 10_000);
    assert_eq!(items[1].interface_name, "wlan0");

    Ok(())
}

#[tokio::test]
async fn traffic_summary_api_returns_summary() -> Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        1_000,
        2_000,
        None,
        None,
        now - Duration::minutes(5),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        3_000,
        4_000,
        None,
        None,
        now - Duration::minutes(1),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/traffic/summary?minutes=60")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["window_minutes"].as_u64(), Some(60));
    assert_eq!(json["interface_count"].as_u64(), Some(1));
    assert!(json["top_talker"].is_object());

    Ok(())
}

#[tokio::test]
async fn traffic_top_talkers_api_returns_ranked_items() -> Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        1_000,
        1_000,
        None,
        None,
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "eth0",
        "interface",
        "eth0",
        None,
        None,
        6_000,
        8_000,
        None,
        None,
        now - Duration::minutes(1),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "wlan0",
        "interface",
        "wlan0",
        None,
        None,
        500,
        500,
        None,
        None,
        now - Duration::minutes(10),
    )
    .await?;

    db::insert_traffic_sample(
        &harness.state.db,
        "wlan0",
        "interface",
        "wlan0",
        None,
        None,
        1_000,
        1_500,
        None,
        None,
        now - Duration::minutes(1),
    )
    .await?;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/traffic/top-talkers?minutes=60&limit=5")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    let items = json["items"].as_array().expect("items should be an array");
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["interface_name"].as_str(), Some("eth0"));

    Ok(())
}

#[tokio::test]
async fn capture_export_requests_can_be_created_and_listed() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "device_ip_address": "192.168.1.20",
                        "mac_address": null,
                        "window_minutes": 60,
                        "note": "High traffic movement observed from top talker drawer"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;

    assert_eq!(created["source"].as_str(), Some("traffic_top_talker"));
    assert_eq!(created["status"].as_str(), Some("requested"));
    assert!(created["queued_at"].is_null());
    assert!(created["started_at"].is_null());
    assert!(created["completed_at"].is_null());
    assert!(created["failed_at"].is_null());
    assert!(created["cancelled_at"].is_null());
    assert!(created["failure_reason"].is_null());
    assert!(created["duration_seconds"].is_null());
    assert!(created["output_filename"].is_null());
    assert!(created["file_size_bytes"].is_null());
    assert_eq!(created["interface_name"].as_str(), Some("eth0"));
    assert_eq!(created["entity_key"].as_str(), Some("eth0"));
    assert!(created["id"].as_i64().is_some());

    let list_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/captures/export-requests?limit=10")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(list_response.status(), StatusCode::OK);

    let list_body = to_bytes(list_response.into_body(), usize::MAX).await?;
    let listed: Value = serde_json::from_slice(&list_body)?;
    let items = listed.as_array().expect("response should be an array");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["source"].as_str(), Some("traffic_top_talker"));
    assert_eq!(items[0]["status"].as_str(), Some("requested"));

    Ok(())
}

#[tokio::test]
async fn capture_export_request_requires_source() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "",
                        "interface_name": "eth0"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    Ok(())
}

#[tokio::test]
async fn capture_export_request_can_be_loaded_by_id() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_sample",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60,
                        "note": "Inspect this traffic sample"
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = to_bytes(get_response.into_body(), usize::MAX).await?;
    let loaded: Value = serde_json::from_slice(&get_body)?;

    assert_eq!(loaded["id"].as_i64(), Some(id));
    assert_eq!(loaded["status"].as_str(), Some("requested"));

    Ok(())
}

#[tokio::test]
async fn capture_export_request_can_be_queued() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let queue_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::OK);

    let queue_body = to_bytes(queue_response.into_body(), usize::MAX).await?;
    let queued: Value = serde_json::from_slice(&queue_body)?;

    assert_eq!(queued["id"].as_i64(), Some(id));
    assert_eq!(queued["status"].as_str(), Some("queued"));
    assert!(queued["queued_at"].as_str().is_some());
    assert!(queued["started_at"].is_null());
    assert!(queued["completed_at"].is_null());

    Ok(())
}

#[tokio::test]
async fn queued_capture_export_request_can_be_cancelled() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let queue_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::OK);

    let cancel_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/cancel"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(cancel_response.status(), StatusCode::OK);

    let cancel_body = to_bytes(cancel_response.into_body(), usize::MAX).await?;
    let cancelled: Value = serde_json::from_slice(&cancel_body)?;

    assert_eq!(cancelled["id"].as_i64(), Some(id));
    assert_eq!(cancelled["status"].as_str(), Some("cancelled"));
    assert!(cancelled["queued_at"].as_str().is_some());
    assert!(cancelled["cancelled_at"].as_str().is_some());

    Ok(())
}

#[tokio::test]
async fn cancelled_capture_export_request_cannot_be_queued() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let cancel_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/cancel"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(cancel_response.status(), StatusCode::OK);

    let queue_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::CONFLICT);

    Ok(())
}

#[tokio::test]
async fn missing_capture_export_request_returns_not_found() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/captures/export-requests/9999")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    Ok(())
}

#[tokio::test]
async fn capture_worker_marks_queued_request_failed_when_execution_is_disabled() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let queue_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::OK);

    let processed = captures::process_next_capture_export_request(
        &harness.state.db,
        &harness.state.config.capture,
    )
    .await?;

    assert!(processed);

    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = to_bytes(get_response.into_body(), usize::MAX).await?;
    let loaded: Value = serde_json::from_slice(&get_body)?;

    assert_eq!(loaded["id"].as_i64(), Some(id));
    assert_eq!(loaded["status"].as_str(), Some("failed"));
    assert!(loaded["queued_at"].as_str().is_some());
    assert!(loaded["started_at"].as_str().is_some());
    assert!(loaded["failed_at"].as_str().is_some());
    assert_eq!(
        loaded["failure_reason"].as_str(),
        Some("capture execution is not enabled")
    );

    Ok(())
}

#[tokio::test]
async fn capture_worker_handles_enabled_capture_execution_path() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.execution_enabled = true;
    harness.state.config.capture.allowed_interfaces = vec!["eth0".to_string()];

    let temp_dir = std::env::temp_dir().join(format!(
        "lag-rat-runner-test-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    harness.state.config.capture.output_dir = temp_dir.to_string_lossy().to_string();

    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "device",
                        "entity_key": "192.168.1.20",
                        "device_ip_address": "192.168.1.20",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let queue_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::OK);

    let processed = captures::process_next_capture_export_request(
        &harness.state.db,
        &harness.state.config.capture,
    )
    .await?;

    assert!(processed);

    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = to_bytes(get_response.into_body(), usize::MAX).await?;
    let loaded: Value = serde_json::from_slice(&get_body)?;

    assert_eq!(loaded["id"].as_i64(), Some(id));

    let status = loaded["status"].as_str().expect("status should be present");

    assert!(
        status == "failed" || status == "completed",
        "unexpected capture status: {status}"
    );

    assert!(loaded["started_at"].as_str().is_some());

    if status == "completed" {
        assert!(loaded["completed_at"].as_str().is_some());
        assert!(loaded["failed_at"].is_null());
        assert!(loaded["failure_reason"].is_null());

        assert_eq!(loaded["duration_seconds"].as_i64(), Some(30));

        let output_filename = loaded["output_filename"]
            .as_str()
            .expect("output filename should be persisted");

        assert!(output_filename.starts_with(&format!("capture-{id}-")));
        assert!(output_filename.ends_with(".pcap"));

        let capture_reference = loaded["capture_reference"]
            .as_str()
            .expect("capture reference should be persisted");

        assert!(capture_reference.contains("capture-"));
        assert!(capture_reference.ends_with(".pcap"));

        let _ = tokio::fs::remove_dir_all(temp_dir).await;
    } else {
        assert!(loaded["failed_at"].as_str().is_some());

        let failure_reason = loaded["failure_reason"]
            .as_str()
            .expect("failure reason should be present");

        assert!(
            failure_reason == "tcpdump is not available"
                || failure_reason.contains("capture command failed")
                || failure_reason == "capture command timed out",
            "unexpected failure reason: {failure_reason}"
        );
    }

    Ok(())
}

#[tokio::test]
async fn capture_worker_noops_when_no_request_is_queued() -> Result<()> {
    let harness = TestHarness::new().await?;

    let processed = captures::process_next_capture_export_request(
        &harness.state.db,
        &harness.state.config.capture,
    )
    .await?;

    assert!(!processed);

    Ok(())
}

#[tokio::test]
async fn capture_command_metadata_is_only_attached_to_running_requests() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let updated = db::attach_capture_export_request_command_metadata(
        &harness.state.db,
        id,
        30,
        "capture-test.pcap",
        "data/captures/capture-test.pcap",
    )
    .await?;

    assert!(updated.is_none());

    let loaded = db::get_capture_export_request(&harness.state.db, id)
        .await?
        .expect("request should exist");

    assert_eq!(loaded.status, "requested");
    assert!(loaded.duration_seconds.is_none());
    assert!(loaded.output_filename.is_none());
    assert!(loaded.capture_reference.is_none());

    Ok(())
}

#[tokio::test]
async fn capture_worker_fails_request_when_output_dir_is_invalid() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.execution_enabled = true;
    harness.state.config.capture.allowed_interfaces = vec!["eth0".to_string()];
    harness.state.config.capture.output_dir = "   ".to_string();

    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "device",
                        "entity_key": "192.168.1.20",
                        "device_ip_address": "192.168.1.20",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let queue_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/captures/export-requests/{id}/queue"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(queue_response.status(), StatusCode::OK);

    let processed = captures::process_next_capture_export_request(
        &harness.state.db,
        &harness.state.config.capture,
    )
    .await?;

    assert!(processed);

    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = to_bytes(get_response.into_body(), usize::MAX).await?;
    let loaded: Value = serde_json::from_slice(&get_body)?;

    assert_eq!(loaded["status"].as_str(), Some("failed"));
    assert_eq!(
        loaded["failure_reason"].as_str(),
        Some("capture output directory is not ready")
    );
    assert!(loaded["output_filename"].is_null());
    assert!(loaded["capture_reference"].is_null());

    Ok(())
}

#[tokio::test]
async fn capture_request_can_only_complete_from_running_status() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let completed =
        db::complete_capture_export_request(&harness.state.db, id, chrono::Utc::now(), Some(1024))
            .await?;

    assert!(completed.is_none());

    let loaded = db::get_capture_export_request(&harness.state.db, id)
        .await?
        .expect("request should exist");

    assert_eq!(loaded.status, "requested");
    assert!(loaded.completed_at.is_none());
    assert!(loaded.file_size_bytes.is_none());

    Ok(())
}

#[tokio::test]
async fn capture_export_request_can_be_deleted() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(delete_response.status(), StatusCode::OK);

    let delete_body = to_bytes(delete_response.into_body(), usize::MAX).await?;
    let deleted: Value = serde_json::from_slice(&delete_body)?;

    assert_eq!(deleted["id"].as_i64(), Some(id));
    assert_eq!(deleted["deleted"].as_bool(), Some(true));
    assert_eq!(deleted["file_deleted"].as_bool(), Some(false));

    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(get_response.status(), StatusCode::NOT_FOUND);

    Ok(())
}

#[tokio::test]
async fn running_capture_export_request_cannot_be_deleted() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    db::queue_capture_export_request(&harness.state.db, id, chrono::Utc::now()).await?;
    db::start_capture_export_request(&harness.state.db, id, chrono::Utc::now()).await?;

    let delete_response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/captures/export-requests/{id}"))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(delete_response.status(), StatusCode::CONFLICT);

    Ok(())
}

#[tokio::test]
async fn stale_running_capture_export_requests_are_marked_failed() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let now = Utc::now();
    let started_at = now - Duration::seconds(180);

    db::queue_capture_export_request(&harness.state.db, id, now - Duration::seconds(181)).await?;
    db::start_capture_export_request(&harness.state.db, id, started_at).await?;

    let recovered_count = db::fail_stale_running_capture_export_requests(
        &harness.state.db,
        now - Duration::seconds(120),
        now,
        "capture request was recovered after becoming stale",
    )
    .await?;

    assert_eq!(recovered_count, 1);

    let loaded = db::get_capture_export_request(&harness.state.db, id)
        .await?
        .expect("request should exist");

    assert_eq!(loaded.status, "failed");
    assert!(loaded.failed_at.is_some());
    assert_eq!(
        loaded.failure_reason.as_deref(),
        Some("capture request was recovered after becoming stale")
    );

    Ok(())
}

#[tokio::test]
async fn fresh_running_capture_export_requests_are_not_recovered() -> Result<()> {
    let harness = TestHarness::new().await?;
    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let now = Utc::now();

    db::queue_capture_export_request(&harness.state.db, id, now - Duration::seconds(10)).await?;
    db::start_capture_export_request(&harness.state.db, id, now - Duration::seconds(5)).await?;

    let recovered_count = db::fail_stale_running_capture_export_requests(
        &harness.state.db,
        now - Duration::seconds(120),
        now,
        "capture request was recovered after becoming stale",
    )
    .await?;

    assert_eq!(recovered_count, 0);

    let loaded = db::get_capture_export_request(&harness.state.db, id)
        .await?
        .expect("request should exist");

    assert_eq!(loaded.status, "running");
    assert!(loaded.failed_at.is_none());
    assert!(loaded.failure_reason.is_none());

    Ok(())
}

#[tokio::test]
async fn capture_worker_recovers_stale_running_request_before_processing_queue() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.max_duration_seconds = 30;

    let app = api::router(harness.state.clone());

    let stale_create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(stale_create_response.status(), StatusCode::OK);

    let stale_create_body = to_bytes(stale_create_response.into_body(), usize::MAX).await?;
    let stale_created: Value = serde_json::from_slice(&stale_create_body)?;
    let stale_id = stale_created["id"]
        .as_i64()
        .expect("created request should have id");

    let queued_create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(queued_create_response.status(), StatusCode::OK);

    let queued_create_body = to_bytes(queued_create_response.into_body(), usize::MAX).await?;
    let queued_created: Value = serde_json::from_slice(&queued_create_body)?;
    let queued_id = queued_created["id"]
        .as_i64()
        .expect("created request should have id");

    let now = Utc::now();

    db::queue_capture_export_request(&harness.state.db, stale_id, now - Duration::seconds(200))
        .await?;
    db::start_capture_export_request(&harness.state.db, stale_id, now - Duration::seconds(120))
        .await?;

    db::queue_capture_export_request(&harness.state.db, queued_id, now).await?;

    let processed = captures::process_next_capture_export_request(
        &harness.state.db,
        &harness.state.config.capture,
    )
    .await?;

    assert!(processed);

    let stale_loaded = db::get_capture_export_request(&harness.state.db, stale_id)
        .await?
        .expect("stale request should exist");

    assert_eq!(stale_loaded.status, "failed");
    assert_eq!(
        stale_loaded.failure_reason.as_deref(),
        Some("capture request was recovered after becoming stale")
    );

    let queued_loaded = db::get_capture_export_request(&harness.state.db, queued_id)
        .await?
        .expect("queued request should exist");

    assert_eq!(queued_loaded.status, "failed");
    assert_eq!(
        queued_loaded.failure_reason.as_deref(),
        Some("capture execution is not enabled")
    );

    Ok(())
}

#[tokio::test]
async fn capture_recovery_uses_max_duration_plus_buffer() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.max_duration_seconds = 30;

    let app = api::router(harness.state.clone());

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/captures/export-requests")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "source": "traffic_top_talker",
                        "interface_name": "eth0",
                        "entity_type": "interface",
                        "entity_key": "eth0",
                        "window_minutes": 60
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = to_bytes(create_response.into_body(), usize::MAX).await?;
    let created: Value = serde_json::from_slice(&create_body)?;
    let id = created["id"]
        .as_i64()
        .expect("created request should have id");

    let now = Utc::now();

    db::queue_capture_export_request(&harness.state.db, id, now - Duration::seconds(91)).await?;
    db::start_capture_export_request(&harness.state.db, id, now - Duration::seconds(91)).await?;

    let recovered = captures::recover_stale_running_capture_export_requests(
        &harness.state.db,
        &harness.state.config.capture,
        now,
    )
    .await?;

    assert_eq!(recovered, 1);

    Ok(())
}

#[tokio::test]
async fn capture_readiness_reports_disabled_execution() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.execution_enabled = false;
    harness.state.config.capture.allowed_interfaces = vec!["wlo1".to_string()];

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/captures/readiness")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["execution_enabled"].as_bool(), Some(false));
    assert_eq!(json["can_execute"].as_bool(), Some(false));
    assert_eq!(json["allowed_interfaces"][0].as_str(), Some("wlo1"));
    assert_eq!(json["default_duration_seconds"].as_u64(), Some(30));
    assert_eq!(json["max_file_mb"].as_u64(), Some(50));

    let issues = json["issues"]
        .as_array()
        .expect("issues should be an array");
    assert!(issues
        .iter()
        .any(|issue| issue["key"].as_str() == Some("execution_disabled")));

    Ok(())
}

#[tokio::test]
async fn capture_readiness_reports_invalid_duration_config() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.execution_enabled = true;
    harness.state.config.capture.min_duration_seconds = 120;
    harness.state.config.capture.default_duration_seconds = 30;
    harness.state.config.capture.max_duration_seconds = 60;

    let app = api::router(harness.state.clone());

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/captures/readiness")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await?;
    let json: Value = serde_json::from_slice(&body)?;

    assert_eq!(json["can_execute"].as_bool(), Some(false));
    assert_eq!(json["duration_bounds_valid"].as_bool(), Some(false));

    let issues = json["issues"]
        .as_array()
        .expect("issues should be an array");
    assert!(issues
        .iter()
        .any(|issue| issue["key"].as_str() == Some("invalid_duration_bounds")));

    Ok(())
}
