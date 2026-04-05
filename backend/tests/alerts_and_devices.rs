mod common;

use chrono::Utc;
use common::TestHarness;

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

    let alerts = lag_rat_backend::db::list_alerts(&harness.state.db, 10).await?;
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

    let alerts = lag_rat_backend::db::list_alerts(&harness.state.db, 10).await?;
    assert!(!alerts[0].is_active);
    assert!(alerts[0].resolved_at.is_some());

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
