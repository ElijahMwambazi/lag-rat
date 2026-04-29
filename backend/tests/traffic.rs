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
async fn capture_worker_builds_command_but_fails_when_runner_is_missing() -> Result<()> {
    let mut harness = TestHarness::new().await?;
    harness.state.config.capture.execution_enabled = true;
    harness.state.config.capture.allowed_interfaces = vec!["eth0".to_string()];

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
    assert_eq!(loaded["status"].as_str(), Some("failed"));
    assert!(loaded["started_at"].as_str().is_some());
    assert!(loaded["failed_at"].as_str().is_some());
    assert_eq!(
        loaded["failure_reason"].as_str(),
        Some("capture command built but execution runner is not implemented")
    );
    assert_eq!(loaded["duration_seconds"].as_i64(), Some(30));

    let output_filename = loaded["output_filename"]
        .as_str()
        .expect("output filename should be persisted");

    assert!(output_filename.starts_with(&format!("capture-{id}-")));
    assert!(output_filename.ends_with(".pcap"));

    let capture_reference = loaded["capture_reference"]
        .as_str()
        .expect("capture reference should be persisted");

    assert!(capture_reference.starts_with("data/captures/capture-"));
    assert!(capture_reference.ends_with(".pcap"));

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
        Some("capture output directory is required")
    );
    assert!(loaded["output_filename"].is_null());
    assert!(loaded["capture_reference"].is_null());

    Ok(())
}
