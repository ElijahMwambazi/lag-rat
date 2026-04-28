use anyhow::Result;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use serde_json::Value;
use tower::ServiceExt;

use lag_rat_backend::{api, db};

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
