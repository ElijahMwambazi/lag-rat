mod common;

use common::TestHarness;
use sqlx::Row;

#[tokio::test]
async fn migrations_are_tracked_and_applied_once() -> anyhow::Result<()> {
    let harness = TestHarness::new().await?;

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM schema_migrations")
        .fetch_one(&harness.state.db)
        .await?;
    assert_eq!(count, 2);

    let old_dir = std::env::current_dir()?;
    std::env::set_current_dir(harness.root.join("backend"))?;
    lag_rat_backend::db::run_migrations(&harness.state.db).await?;
    std::env::set_current_dir(old_dir)?;

    let count_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM schema_migrations")
        .fetch_one(&harness.state.db)
        .await?;
    assert_eq!(count_after, 2);

    let row = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='outages'")
        .fetch_one(&harness.state.db)
        .await?;
    let table_name: String = row.get("name");
    assert_eq!(table_name, "outages");

    Ok(())
}
