mod common;

use chrono::{Duration, Utc};
use common::TestHarness;

#[tokio::test]
async fn overview_aggregates_latest_health_devices_and_outages() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let now = Utc::now();

    lag_rat_backend::db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(2),
        "192.168.1.1:80",
        "router",
        true,
        Some(3.0),
        None,
    )
    .await?;

    lag_rat_backend::db::insert_connectivity_check(
        &harness.state.db,
        now - Duration::minutes(1),
        "https://example.com",
        "internet",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    lag_rat_backend::db::insert_dns_check(
        &harness.state.db,
        now,
        "example.com",
        "1.1.1.1",
        true,
        Some(18.0),
        None,
    )
    .await?;

    lag_rat_backend::db::upsert_device(
        &harness.state.db,
        "192.168.1.10",
        Some("aa:bb:cc:dd:ee:ff"),
        Some("phone"),
        now,
    )
    .await?;

    let overview = lag_rat_backend::services::status_overview::build(&harness.state).await?;

    assert!(overview.router.is_healthy);
    assert!(!overview.internet.is_healthy);
    assert!(overview.internet.active_outage);
    assert!(overview.dns.is_healthy);
    assert_eq!(overview.devices.active_count_24h, 1);
    assert_eq!(overview.outages.active_count, 1);
    assert!(overview.internet.latest_error_message.is_some());

    Ok(())
}
