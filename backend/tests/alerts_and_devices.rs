mod common;

use chrono::{Duration, Utc};
use common::TestHarness;
use lag_rat_backend::monitors::connectivity::ProbeResult;

#[tokio::test]
async fn alert_opens_and_resolves() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    lag_rat_backend::db::upsert_alert_state(
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

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);

    lag_rat_backend::db::upsert_alert_state(
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

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert!(!alerts[0].is_active);
    assert!(alerts[0].resolved_at.is_some());

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

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &failed_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert_eq!(alerts.len(), 0);

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &failed_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
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

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::db::insert_connectivity_check(
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

    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &failed_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
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

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &failed_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &success_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert!(alerts[0].is_active);

    lag_rat_backend::db::insert_connectivity_check(
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
    lag_rat_backend::services::alerts::evaluate_connectivity(
        &harness.state,
        "internet_http",
        target,
        &success_probe,
    )
    .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
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

    lag_rat_backend::db::insert_dns_check(
        &harness.state.db,
        t1,
        domain,
        "1.1.1.1",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    lag_rat_backend::services::alerts::evaluate_dns(&harness.state, domain, false, Some("timeout"))
        .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert_eq!(alerts.len(), 0);

    lag_rat_backend::db::insert_dns_check(
        &harness.state.db,
        t2,
        domain,
        "1.1.1.1",
        false,
        None,
        Some("timeout"),
    )
    .await?;
    lag_rat_backend::services::alerts::evaluate_dns(&harness.state, domain, false, Some("timeout"))
        .await?;

    let alerts =
        lag_rat_backend::db::list_alerts_filtered(&harness.state.db, None, None, None, None, 10)
            .await?;
    assert_eq!(alerts.len(), 1);
    assert!(alerts[0].is_active);
    assert_eq!(alerts[0].severity, "warning");

    Ok(())
}

#[tokio::test]
async fn enriched_devices_include_labels_and_gateway_flag() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    lag_rat_backend::db::upsert_device(
        &harness.state.db,
        "192.168.1.1",
        Some("aa:bb:cc:dd:ee:ff"),
        Some("router-host"),
        Utc::now(),
    )
    .await?;

    let enriched = lag_rat_backend::services::devices::list_enriched(&harness.state).await?;
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
