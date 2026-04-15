mod common;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::{api, db};
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
