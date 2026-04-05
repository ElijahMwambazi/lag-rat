use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use sqlx::{Row, SqlitePool};

use crate::models::{ConnectivityCheck, Device, DnsCheck, Outage, SummaryResponse, TimeseriesPoint};

pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    let migrations_dir = Path::new("migrations");
    let mut entries = fs::read_dir(migrations_dir)?
        .collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.path());

    for entry in entries {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("sql") {
            continue;
        }

        let version = match path.file_name().and_then(|n| n.to_str()) {
            Some(v) => v.to_string(),
            None => continue,
        };

        let already_applied = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
        )
        .bind(&version)
        .fetch_one(pool)
        .await?;

        if already_applied > 0 {
            continue;
        }

        let sql = fs::read_to_string(&path)?;
        let mut tx = pool.begin().await?;

        for statement in sql.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            sqlx::query(statement).execute(&mut *tx).await?;
        }

        sqlx::query(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        )
        .bind(&version)
        .bind(Utc::now())
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
    }

    Ok(())
}

pub async fn insert_connectivity_check(
    pool: &SqlitePool,
    timestamp: DateTime<Utc>,
    target: &str,
    target_type: &str,
    success: bool,
    latency_ms: Option<f64>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO connectivity_checks (
            timestamp, target, target_type, success, latency_ms, packet_loss_pct, error_message
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
    )
    .bind(timestamp)
    .bind(target)
    .bind(target_type)
    .bind(success)
    .bind(latency_ms)
    .bind(if success { Some(0.0) } else { Some(100.0) })
    .bind(error_message)
    .execute(pool)
    .await?;

    upsert_outage_state(pool, target_type, target, success, timestamp, error_message).await?;
    Ok(())
}

pub async fn insert_dns_check(
    pool: &SqlitePool,
    timestamp: DateTime<Utc>,
    domain: &str,
    resolver: &str,
    success: bool,
    response_time_ms: Option<f64>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO dns_checks (
            timestamp, domain, resolver, success, response_time_ms, error_message
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
    )
    .bind(timestamp)
    .bind(domain)
    .bind(resolver)
    .bind(success)
    .bind(response_time_ms)
    .bind(error_message)
    .execute(pool)
    .await?;

    upsert_outage_state(pool, "dns", domain, success, timestamp, error_message).await?;
    Ok(())
}

async fn upsert_outage_state(
    pool: &SqlitePool,
    outage_type: &str,
    target: &str,
    success: bool,
    timestamp: DateTime<Utc>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    let active = sqlx::query_as::<_, Outage>(
        r#"
        SELECT id, outage_type, target, started_at, ended_at, is_active, start_error, end_note
        FROM outages
        WHERE outage_type = ?1 AND target = ?2 AND is_active = 1
        ORDER BY started_at DESC
        LIMIT 1
        "#,
    )
    .bind(outage_type)
    .bind(target)
    .fetch_optional(pool)
    .await?;

    match (success, active) {
        (false, None) => {
            sqlx::query(
                r#"
                INSERT INTO outages (outage_type, target, started_at, ended_at, is_active, start_error, end_note)
                VALUES (?1, ?2, ?3, NULL, 1, ?4, NULL)
                "#,
            )
            .bind(outage_type)
            .bind(target)
            .bind(timestamp)
            .bind(error_message)
            .execute(pool)
            .await?;
        }
        (true, Some(outage)) => {
            sqlx::query(
                r#"
                UPDATE outages
                SET ended_at = ?1, is_active = 0, end_note = ?2
                WHERE id = ?3
                "#,
            )
            .bind(timestamp)
            .bind("recovered")
            .bind(outage.id)
            .execute(pool)
            .await?;
        }
        _ => {}
    }

    Ok(())
}

pub async fn latest_connectivity_success(
    pool: &SqlitePool,
    target_type: &str,
) -> anyhow::Result<Option<(bool, DateTime<Utc>)>> {
    let row = sqlx::query(
        r#"
        SELECT success, timestamp
        FROM connectivity_checks
        WHERE target_type = ?1
        ORDER BY timestamp DESC
        LIMIT 1
        "#,
    )
    .bind(target_type)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => Ok(Some((row.get::<bool, _>("success"), row.get("timestamp")))),
        None => Ok(None),
    }
}

pub async fn latest_dns_success(pool: &SqlitePool) -> anyhow::Result<Option<(bool, DateTime<Utc>)>> {
    let row = sqlx::query(
        r#"
        SELECT success, timestamp
        FROM dns_checks
        ORDER BY timestamp DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => Ok(Some((row.get::<bool, _>("success"), row.get("timestamp")))),
        None => Ok(None),
    }
}

pub async fn connectivity_timeseries(
    pool: &SqlitePool,
    target_type: &str,
    minutes: i64,
) -> anyhow::Result<Vec<TimeseriesPoint>> {
    let rows = sqlx::query(
        r#"
        SELECT timestamp, latency_ms
        FROM connectivity_checks
        WHERE target_type = ?1
          AND latency_ms IS NOT NULL
          AND timestamp >= datetime('now', '-' || ?2 || ' minutes')
        ORDER BY timestamp DESC
        "#,
    )
    .bind(target_type)
    .bind(minutes)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| TimeseriesPoint {
        timestamp: row.get("timestamp"),
        value: row.get("latency_ms"),
    }).collect())
}

pub async fn dns_timeseries(pool: &SqlitePool, minutes: i64) -> anyhow::Result<Vec<TimeseriesPoint>> {
    let rows = sqlx::query(
        r#"
        SELECT timestamp, response_time_ms
        FROM dns_checks
        WHERE response_time_ms IS NOT NULL
          AND timestamp >= datetime('now', '-' || ?1 || ' minutes')
        ORDER BY timestamp DESC
        "#,
    )
    .bind(minutes)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| TimeseriesPoint {
        timestamp: row.get("timestamp"),
        value: row.get("response_time_ms"),
    }).collect())
}

pub async fn list_outages(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<Outage>> {
    let rows = sqlx::query_as::<_, Outage>(
        r#"
        SELECT id, outage_type, target, started_at, ended_at, is_active, start_error, end_note
        FROM outages
        ORDER BY started_at DESC
        LIMIT ?1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn summary_24h(pool: &SqlitePool) -> anyhow::Result<SummaryResponse> {
    let total_row = sqlx::query(
        r#"
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
               AVG(latency_ms) AS avg_latency
        FROM connectivity_checks
        WHERE target_type = 'internet'
          AND timestamp >= datetime('now', '-24 hours')
        "#,
    )
    .fetch_one(pool)
    .await?;

    let total: i64 = total_row.get("total");
    let successes: Option<i64> = total_row.try_get("successes").ok();
    let avg_latency: Option<f64> = total_row.try_get("avg_latency").ok();

    let outage_row = sqlx::query(
        r#"
        SELECT COUNT(*) AS total
        FROM outages
        WHERE started_at >= datetime('now', '-24 hours')
        "#,
    )
    .fetch_one(pool)
    .await?;

    let outage_count_24h: i64 = outage_row.get("total");

    let uptime_pct_24h = if total > 0 {
        (successes.unwrap_or(0) as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(SummaryResponse {
        uptime_pct_24h,
        avg_latency_ms_24h: avg_latency.unwrap_or(0.0),
        outage_count_24h: outage_count_24h as u32,
    })
}

pub async fn upsert_device(
    pool: &SqlitePool,
    ip_address: &str,
    mac_address: Option<&str>,
    hostname: Option<&str>,
    observed_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO devices (ip_address, mac_address, hostname, first_seen, last_seen)
        VALUES (?1, ?2, ?3, ?4, ?4)
        ON CONFLICT(ip_address)
        DO UPDATE SET
            mac_address = COALESCE(excluded.mac_address, devices.mac_address),
            hostname = COALESCE(excluded.hostname, devices.hostname),
            last_seen = excluded.last_seen
        "#,
    )
    .bind(ip_address)
    .bind(mac_address)
    .bind(hostname)
    .bind(observed_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_devices(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<Device>> {
    let rows = sqlx::query_as::<_, Device>(
        r#"
        SELECT id, ip_address, mac_address, hostname, first_seen, last_seen
        FROM devices
        ORDER BY last_seen DESC
        LIMIT ?1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}
