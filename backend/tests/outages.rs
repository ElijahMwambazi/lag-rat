mod common;

use chrono::{Duration, Utc};
use common::TestHarness;

#[tokio::test]
async fn outage_opens_on_failure_and_closes_on_recovery() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;
    let t1 = Utc::now();
    let t2 = t1 + Duration::minutes(5);

    lag_rat_backend::db::insert_connectivity_check(
        &harness.state.db,
        t1,
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        false,
        None,
        Some("timeout"),
    )
    .await?;

    let outages = lag_rat_backend::db::list_outages(&harness.state.db, 10).await?;
    assert_eq!(outages.len(), 1);
    assert!(outages[0].is_active);
    assert_eq!(outages[0].outage_type, "internet_http");
    assert_eq!(outages[0].start_error.as_deref(), Some("timeout"));

    lag_rat_backend::db::insert_connectivity_check(
        &harness.state.db,
        t2,
        "https://www.google.com/generate_204",
        "internet",
        "internet_http",
        true,
        Some(12.4),
        None,
    )
    .await?;

    let outages = lag_rat_backend::db::list_outages(&harness.state.db, 10).await?;
    assert_eq!(outages.len(), 1);
    assert!(!outages[0].is_active);
    assert_eq!(outages[0].outage_type, "internet_http");
    assert_eq!(outages[0].end_note.as_deref(), Some("recovered"));
    assert_eq!(outages[0].ended_at, Some(t2));

    Ok(())
}
