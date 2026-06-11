mod common;

use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::{db, services};

#[tokio::test]
async fn overview_aggregates_latest_health_devices_and_outages() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(3),
        "192.168.1.1:80",
        "router",
        "router_tcp",
        true,
        Some(3.0),
        None,
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(2),
        "1.1.1.1:443",
        "internet",
        "internet_tcp",
        true,
        Some(12.0),
        None,
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(1),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    db::insert_dns_check(
        &harness.state.db,
        now,
        "google.com",
        "1.1.1.1",
        true,
        Some(18.0),
        None,
    )
    .await?;

    db::upsert_device(
        &harness.state.db,
        "192.168.1.10",
        Some("aa:bb:cc:dd:ee:ff"),
        Some("phone"),
        now,
    )
    .await?;

    let overview = services::status_overview::build(&harness.state).await?;

    assert!(overview.router.is_healthy);

    assert!(overview.internet_tcp.is_healthy);
    assert!(!overview.internet_http.is_healthy);

    assert!(overview.internet.is_healthy);
    assert!(overview.internet.active_outage);

    assert!(overview.dns.is_healthy);
    assert_eq!(overview.devices.active_count_24h, 1);
    assert_eq!(overview.outages.active_count, 1);
    assert!(overview.internet.latest_error_message.is_some());

    Ok(())
}

#[tokio::test]
async fn overview_keeps_internet_reachable_when_one_probe_target_fails() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(3),
        "1.1.1.1:443",
        "internet",
        "internet_tcp",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(2),
        "8.8.8.8:443",
        "internet",
        "internet_tcp",
        true,
        Some(20.0),
        None,
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(1),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(40.0),
        None,
    )
    .await?;

    let overview = services::status_overview::build(&harness.state).await?;

    assert!(overview.internet.is_healthy);
    assert_eq!(overview.internet.status, "degraded");
    assert!(overview.internet.latest_error_message.is_some());

    Ok(())
}

#[tokio::test]
async fn overview_marks_internet_unhealthy_when_all_probe_targets_fail() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(3),
        "1.1.1.1:443",
        "internet",
        "internet_tcp",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(2),
        "8.8.8.8:443",
        "internet",
        "internet_tcp",
        false,
        None,
        Some("connection refused"),
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(1),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("http timeout"),
    )
    .await?;

    let overview = services::status_overview::build(&harness.state).await?;

    assert!(!overview.internet.is_healthy);
    assert_eq!(overview.internet.status, "down");
    assert!(overview.internet.latest_error_message.is_some());

    Ok(())
}

#[tokio::test]
async fn overview_includes_alert_summary_counts() -> anyhow::Result<()> {
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
        now - Duration::minutes(3),
    )
    .await?;

    let alerts = db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10).await?;
    let critical_alert_id = alerts
        .iter()
        .find(|alert| alert.entity_type == "internet")
        .map(|alert| alert.id)
        .expect("critical alert should exist");

    db::acknowledge_alert(
        &harness.state.db,
        critical_alert_id,
        now - Duration::minutes(2),
    )
    .await?;

    db::upsert_alert_state(
        &harness.state.db,
        "dns_health",
        "critical",
        "dns",
        "google.com",
        "dns resolution failed",
        true,
        now - Duration::minutes(1),
    )
    .await?;

    db::upsert_alert_state(
        &harness.state.db,
        "router_health",
        "warning",
        "router",
        "192.168.1.1:80",
        "router latency elevated",
        true,
        now,
    )
    .await?;

    db::upsert_alert_state(
        &harness.state.db,
        "router_health",
        "info",
        "router",
        "192.168.1.1:80",
        "router recovered",
        false,
        now + Duration::seconds(30),
    )
    .await?;

    let overview = services::status_overview::build(&harness.state).await?;

    assert_eq!(overview.alerts.active_count, 2);
    assert_eq!(overview.alerts.active_critical_count, 2);
    assert_eq!(overview.alerts.active_unacknowledged_count, 1);
    assert_eq!(overview.alerts.active_unacknowledged_critical_count, 1);
    assert!(overview.alerts.most_recent_created_at.is_some());

    Ok(())
}

#[tokio::test]
async fn overview_marks_internet_healthy_when_all_probe_targets_pass() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(3),
        "8.8.8.8:443",
        "internet",
        "internet_tcp",
        true,
        Some(20.0),
        None,
    )
    .await?;

    db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(1),
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(40.0),
        None,
    )
    .await?;

    let overview = services::status_overview::build(&harness.state).await?;

    assert!(overview.internet.is_healthy);
    assert_eq!(overview.internet.status, "healthy");
    assert!(overview.internet.latest_error_message.is_none());

    Ok(())
}
