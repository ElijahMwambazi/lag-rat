Add or update these signatures in your existing `backend/src/db.rs`.

## insert_connectivity_check
```rust
pub async fn insert_connectivity_check(
    pool: &SqlitePool,
    timestamp: DateTime<Utc>,
    target: &str,
    target_type: &str,
    probe_kind: &str,
    success: bool,
    latency_ms: Option<f64>,
    error_message: Option<&str>,
) -> anyhow::Result<()>
```

Store `probe_kind` in `connectivity_checks` and use `probe_kind` for outage typing.

## connectivity_timeseries
```rust
pub async fn connectivity_timeseries(
    pool: &SqlitePool,
    probe_kind: &str,
    minutes: i64,
) -> anyhow::Result<Vec<TimeseriesPoint>>
```

Query by `probe_kind`, not `target_type`.

## latest/last helpers
Change:
- `latest_connectivity_check`
- `last_successful_connectivity_check`
- `last_failed_connectivity_check`

to filter by `probe_kind`.

## summary_24h
Use `probe_kind = 'internet_http'` for uptime summary.
