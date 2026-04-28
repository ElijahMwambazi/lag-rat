use std::fs;
use std::path::Path;

use chrono::{DateTime, Timelike, Utc};
use sqlx::{Row, SqlitePool};

use crate::models::{
    Alert, CaptureExportRequest, ConnectivityCheck, CreateCaptureExportRequest, Device,
    DeviceHistoryEvent, DnsCheck, IncidentTargetSummaryItem, KnownDevice, MetricsSummaryResponse,
    Outage, ProbeMetricsSummaryItem, RecentAlertEventItem, RecentDeviceEventItem,
    ReportSummaryResponse, ReportTrendPoint, SummaryResponse, TimeseriesPoint, TrafficSample,
    TrafficTopTalkerItem, WifiSample,
};

pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
        .execute(pool).await?;

    let migrations_dir = Path::new("migrations");
    let mut entries = fs::read_dir(migrations_dir)?.collect::<Result<Vec<_>, _>>()?;
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
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)")
            .bind(&version)
            .bind(Utc::now())
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
    }
    Ok(())
}

pub async fn seed_default_known_devices(pool: &SqlitePool, router_ip: &str) -> anyhow::Result<()> {
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM known_devices WHERE ip_address = ?1 AND label = ?2",
    )
    .bind(router_ip)
    .bind("Router")
    .fetch_one(pool)
    .await?;
    if existing == 0 {
        let now = Utc::now();
        sqlx::query("INSERT INTO known_devices (ip_address, mac_address, label, notes, created_at, updated_at) VALUES (?1, NULL, ?2, ?3, ?4, ?4)")
            .bind(router_ip).bind("Router").bind("Seeded default gateway label").bind(now).execute(pool).await?;
    }
    Ok(())
}

pub async fn insert_connectivity_check(
    pool: &SqlitePool,
    timestamp: DateTime<Utc>,
    target: &str,
    target_type: &str,
    probe_kind: &str,
    success: bool,
    latency_ms: Option<f64>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
    "INSERT INTO connectivity_checks (
        timestamp, target, target_type, success, latency_ms, packet_loss_pct, error_message, probe_kind
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
)
.bind(timestamp)
.bind(target)
.bind(target_type)
.bind(success)
.bind(latency_ms)
.bind(if success { Some(0.0) } else { Some(100.0) })
.bind(error_message)
.bind(probe_kind)
.execute(pool)
.await?;
    upsert_outage_state(pool, probe_kind, target, success, timestamp, error_message).await?;
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

pub async fn latest_dns_success(
    pool: &SqlitePool,
) -> anyhow::Result<Option<(bool, DateTime<Utc>)>> {
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

pub async fn insert_dns_check(
    pool: &SqlitePool,
    timestamp: DateTime<Utc>,
    domain: &str,
    resolver: &str,
    success: bool,
    response_time_ms: Option<f64>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query("INSERT INTO dns_checks (timestamp, domain, resolver, success, response_time_ms, error_message) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(timestamp).bind(domain).bind(resolver).bind(success).bind(response_time_ms).bind(error_message)
        .execute(pool).await?;
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
    let active = sqlx::query_as::<_, Outage>("SELECT id, outage_type, target, started_at, ended_at, is_active, start_error, end_note FROM outages WHERE outage_type = ?1 AND target = ?2 AND is_active = 1 ORDER BY started_at DESC LIMIT 1")
        .bind(outage_type).bind(target).fetch_optional(pool).await?;
    match (success, active) {
        (false, None) => {
            sqlx::query("INSERT INTO outages (outage_type, target, started_at, ended_at, is_active, start_error, end_note) VALUES (?1, ?2, ?3, NULL, 1, ?4, NULL)")
                .bind(outage_type).bind(target).bind(timestamp).bind(error_message).execute(pool).await?;
        }
        (true, Some(outage)) => {
            sqlx::query(
                "UPDATE outages SET ended_at = ?1, is_active = 0, end_note = ?2 WHERE id = ?3",
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

pub async fn connectivity_timeseries(
    pool: &SqlitePool,
    probe_kind: &str,
    minutes: i64,
) -> anyhow::Result<Vec<TimeseriesPoint>> {
    let rows = sqlx::query(
        "SELECT timestamp, latency_ms
         FROM connectivity_checks
         WHERE probe_kind = ?1
           AND latency_ms IS NOT NULL
           AND timestamp >= datetime('now', '-' || ?2 || ' minutes')
         ORDER BY timestamp DESC",
    )
    .bind(probe_kind)
    .bind(minutes)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TimeseriesPoint {
            timestamp: row.get("timestamp"),
            value: row.get("latency_ms"),
        })
        .collect())
}

pub async fn dns_timeseries(
    pool: &SqlitePool,
    minutes: i64,
) -> anyhow::Result<Vec<TimeseriesPoint>> {
    let rows = sqlx::query("SELECT timestamp, response_time_ms FROM dns_checks WHERE response_time_ms IS NOT NULL AND timestamp >= datetime('now', '-' || ?1 || ' minutes') ORDER BY timestamp DESC")
        .bind(minutes).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| TimeseriesPoint {
            timestamp: row.get("timestamp"),
            value: row.get("response_time_ms"),
        })
        .collect())
}

pub async fn list_outages_filtered(
    pool: &SqlitePool,
    status: Option<&str>,
    outage_type: Option<&str>,
    search: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<Outage>> {
    let search_term = search
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s));

    Ok(sqlx::query_as::<_, Outage>(
        r#"
            SELECT id, outage_type, target, started_at, ended_at, is_active, start_error, end_note
            FROM outages
            WHERE (?1 IS NULL
                   OR (?1 = 'active' AND is_active = 1)
                   OR (?1 = 'resolved' AND is_active = 0))
              AND (?2 IS NULL OR outage_type = ?2)
              AND (
                    ?3 IS NULL
                    OR target LIKE ?3
                    OR start_error LIKE ?3
                    OR end_note LIKE ?3
                  )
            ORDER BY started_at DESC
            LIMIT ?4
            "#,
    )
    .bind(status)
    .bind(outage_type)
    .bind(search_term.as_deref())
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn summary_24h(pool: &SqlitePool) -> anyhow::Result<SummaryResponse> {
    let total_row = sqlx::query(
        "SELECT COUNT(*) AS total,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
            AVG(latency_ms) AS avg_latency
     FROM connectivity_checks
     WHERE probe_kind = 'internet_http'
       AND timestamp >= datetime('now', '-24 hours')",
    )
    .fetch_one(pool)
    .await?;
    let total: i64 = total_row.get("total");
    let successes: Option<i64> = total_row.try_get("successes").ok();
    let avg_latency: Option<f64> = total_row.try_get("avg_latency").ok();

    let outage_row = sqlx::query(
        "SELECT COUNT(*) AS total FROM outages WHERE started_at >= datetime('now', '-24 hours')",
    )
    .fetch_one(pool)
    .await?;
    let outage_count_24h: i64 = outage_row.get("total");

    Ok(SummaryResponse {
        uptime_pct_24h: if total > 0 {
            (successes.unwrap_or(0) as f64 / total as f64) * 100.0
        } else {
            0.0
        },
        avg_latency_ms_24h: avg_latency.unwrap_or(0.0),
        outage_count_24h: outage_count_24h as u32,
    })
}

pub async fn report_summary(
    pool: &SqlitePool,
    hours: i64,
) -> anyhow::Result<ReportSummaryResponse> {
    let total_row = sqlx::query(
        "SELECT COUNT(*) AS total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
                AVG(latency_ms) AS avg_latency
         FROM connectivity_checks
         WHERE probe_kind = 'internet_http'
           AND timestamp >= datetime('now', '-' || ?1 || ' hours')",
    )
    .bind(hours)
    .fetch_one(pool)
    .await?;

    let total: i64 = total_row.get("total");
    let successes: Option<i64> = total_row.try_get("successes").ok();
    let avg_latency: Option<f64> = total_row.try_get("avg_latency").ok();

    let outage_row = sqlx::query(
        "SELECT COUNT(*) AS total,
                COALESCE(SUM(
                    CAST(
                        (julianday(COALESCE(ended_at, CURRENT_TIMESTAMP)) - julianday(started_at)) * 86400
                        AS INTEGER
                    )
                ), 0) AS total_downtime_seconds
         FROM outages
         WHERE started_at >= datetime('now', '-' || ?1 || ' hours')",
    )
    .bind(hours)
    .fetch_one(pool)
    .await?;

    let outage_count: i64 = outage_row.get("total");
    let total_downtime_seconds: i64 = outage_row.try_get("total_downtime_seconds").unwrap_or(0);

    let dns_failure_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM dns_checks
         WHERE success = 0
           AND timestamp >= datetime('now', '-' || ?1 || ' hours')",
    )
    .bind(hours)
    .fetch_one(pool)
    .await?;

    let device_history_event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM device_history
         WHERE created_at >= datetime('now', '-' || ?1 || ' hours')",
    )
    .bind(hours)
    .fetch_one(pool)
    .await?;

    let active_alert_count = active_alerts_count(pool).await?;
    let active_critical_alert_count = active_critical_alerts_count(pool).await?;
    let active_unacknowledged_alert_count = active_unacknowledged_alerts_count(pool).await?;

    Ok(ReportSummaryResponse {
        window_hours: hours as u32,
        uptime_pct: if total > 0 {
            (successes.unwrap_or(0) as f64 / total as f64) * 100.0
        } else {
            0.0
        },
        avg_latency_ms: avg_latency.unwrap_or(0.0),
        outage_count: outage_count as u32,
        total_downtime_seconds,
        dns_failure_count: dns_failure_count as u32,
        device_history_event_count: device_history_event_count as u32,
        active_alert_count,
        active_critical_alert_count,
        active_unacknowledged_alert_count,
    })
}

pub async fn metrics_summary(
    pool: &SqlitePool,
    minutes: i64,
) -> anyhow::Result<MetricsSummaryResponse> {
    let http = connectivity_probe_metrics_summary(
        pool,
        "internet_http",
        "internet_http",
        "Internet HTTP",
        minutes,
    )
    .await?;

    let tcp = connectivity_probe_metrics_summary(
        pool,
        "internet_tcp",
        "internet_tcp",
        "Internet TCP",
        minutes,
    )
    .await?;

    let dns = dns_probe_metrics_summary(pool, "dns", "DNS", minutes).await?;

    Ok(MetricsSummaryResponse {
        window_minutes: minutes as u32,
        items: vec![http, tcp, dns],
    })
}

async fn connectivity_probe_metrics_summary(
    pool: &SqlitePool,
    key: &str,
    probe_kind: &str,
    label: &str,
    minutes: i64,
) -> anyhow::Result<ProbeMetricsSummaryItem> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) AS total_checks,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failure_count,
            AVG(latency_ms) AS avg_latency_ms,
            MAX(timestamp) AS last_checked_at
        FROM connectivity_checks
        WHERE probe_kind = ?1
          AND timestamp >= datetime('now', '-' || ?2 || ' minutes')
        "#,
    )
    .bind(probe_kind)
    .bind(minutes)
    .fetch_one(pool)
    .await?;

    let latest_row = sqlx::query(
        r#"
        SELECT latency_ms
        FROM connectivity_checks
        WHERE probe_kind = ?1
          AND timestamp >= datetime('now', '-' || ?2 || ' minutes')
        ORDER BY timestamp DESC
        LIMIT 1
        "#,
    )
    .bind(probe_kind)
    .bind(minutes)
    .fetch_optional(pool)
    .await?;

    let total_checks: i64 = row.get("total_checks");
    let success_count: i64 = row.try_get("success_count").unwrap_or(0);
    let failure_count: i64 = row.try_get("failure_count").unwrap_or(0);
    let avg_latency_ms: Option<f64> = row.try_get("avg_latency_ms").ok();
    let last_checked_at: Option<DateTime<Utc>> = row.try_get("last_checked_at").ok();
    let latest_latency_ms: Option<f64> = latest_row
        .as_ref()
        .and_then(|latest| latest.try_get("latency_ms").ok());

    Ok(ProbeMetricsSummaryItem {
        key: key.to_string(),
        label: label.to_string(),
        total_checks: total_checks as u32,
        success_count: success_count as u32,
        failure_count: failure_count as u32,
        success_rate_pct: if total_checks > 0 {
            (success_count as f64 / total_checks as f64) * 100.0
        } else {
            0.0
        },
        avg_latency_ms: avg_latency_ms.unwrap_or(0.0),
        latest_latency_ms,
        last_checked_at,
    })
}

async fn dns_probe_metrics_summary(
    pool: &SqlitePool,
    key: &str,
    label: &str,
    minutes: i64,
) -> anyhow::Result<ProbeMetricsSummaryItem> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) AS total_checks,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failure_count,
            AVG(response_time_ms) AS avg_latency_ms,
            MAX(timestamp) AS last_checked_at
        FROM dns_checks
        WHERE timestamp >= datetime('now', '-' || ?1 || ' minutes')
        "#,
    )
    .bind(minutes)
    .fetch_one(pool)
    .await?;

    let latest_row = sqlx::query(
        r#"
        SELECT response_time_ms
        FROM dns_checks
        WHERE timestamp >= datetime('now', '-' || ?1 || ' minutes')
        ORDER BY timestamp DESC
        LIMIT 1
        "#,
    )
    .bind(minutes)
    .fetch_optional(pool)
    .await?;

    let total_checks: i64 = row.get("total_checks");
    let success_count: i64 = row.try_get("success_count").unwrap_or(0);
    let failure_count: i64 = row.try_get("failure_count").unwrap_or(0);
    let avg_latency_ms: Option<f64> = row.try_get("avg_latency_ms").ok();
    let last_checked_at: Option<DateTime<Utc>> = row.try_get("last_checked_at").ok();
    let latest_latency_ms: Option<f64> = latest_row
        .as_ref()
        .and_then(|latest| latest.try_get("response_time_ms").ok());

    Ok(ProbeMetricsSummaryItem {
        key: key.to_string(),
        label: label.to_string(),
        total_checks: total_checks as u32,
        success_count: success_count as u32,
        failure_count: failure_count as u32,
        success_rate_pct: if total_checks > 0 {
            (success_count as f64 / total_checks as f64) * 100.0
        } else {
            0.0
        },
        avg_latency_ms: avg_latency_ms.unwrap_or(0.0),
        latest_latency_ms,
        last_checked_at,
    })
}

pub async fn report_trends(pool: &SqlitePool, hours: i64) -> anyhow::Result<Vec<ReportTrendPoint>> {
    let bucket_format = if hours <= 24 {
        "%Y-%m-%d %H:00:00"
    } else {
        "%Y-%m-%d 00:00:00"
    };

    let step_hours = if hours <= 24 { 1 } else { 24 };
    let bucket_count = if hours <= 24 { 24 } else { 7 };

    let outage_rows = sqlx::query(
        r#"
        SELECT
            strftime(?1, started_at) AS bucket_key,
            COUNT(*) AS outage_count
        FROM outages
        WHERE started_at >= datetime('now', '-' || ?2 || ' hours')
        GROUP BY bucket_key
        "#,
    )
    .bind(bucket_format)
    .bind(hours)
    .fetch_all(pool)
    .await?;

    let dns_rows = sqlx::query(
        r#"
        SELECT
            strftime(?1, timestamp) AS bucket_key,
            COUNT(*) AS dns_failure_count
        FROM dns_checks
        WHERE success = 0
          AND timestamp >= datetime('now', '-' || ?2 || ' hours')
        GROUP BY bucket_key
        "#,
    )
    .bind(bucket_format)
    .bind(hours)
    .fetch_all(pool)
    .await?;

    let http_rows = sqlx::query(
        r#"
        SELECT
            strftime(?1, timestamp) AS bucket_key,
            COUNT(*) AS failure_count
        FROM connectivity_checks
        WHERE probe_kind = 'internet_http'
          AND success = 0
          AND timestamp >= datetime('now', '-' || ?2 || ' hours')
        GROUP BY bucket_key
        "#,
    )
    .bind(bucket_format)
    .bind(hours)
    .fetch_all(pool)
    .await?;

    let tcp_rows = sqlx::query(
        r#"
        SELECT
            strftime(?1, timestamp) AS bucket_key,
            COUNT(*) AS failure_count
        FROM connectivity_checks
        WHERE probe_kind = 'internet_tcp'
          AND success = 0
          AND timestamp >= datetime('now', '-' || ?2 || ' hours')
        GROUP BY bucket_key
        "#,
    )
    .bind(bucket_format)
    .bind(hours)
    .fetch_all(pool)
    .await?;

    let mut outage_map = std::collections::HashMap::new();
    for row in outage_rows {
        let key: String = row.get("bucket_key");
        let count: i64 = row.get("outage_count");
        outage_map.insert(key, count as u32);
    }

    let mut dns_map = std::collections::HashMap::new();
    for row in dns_rows {
        let key: String = row.get("bucket_key");
        let count: i64 = row.get("dns_failure_count");
        dns_map.insert(key, count as u32);
    }

    let mut http_map = std::collections::HashMap::new();
    for row in http_rows {
        let key: String = row.get("bucket_key");
        let count: i64 = row.get("failure_count");
        http_map.insert(key, count as u32);
    }

    let mut tcp_map = std::collections::HashMap::new();
    for row in tcp_rows {
        let key: String = row.get("bucket_key");
        let count: i64 = row.get("failure_count");
        tcp_map.insert(key, count as u32);
    }

    let now = Utc::now();
    let mut points = Vec::with_capacity(bucket_count);

    for index in (0..bucket_count).rev() {
        let bucket_start = now - chrono::Duration::hours((index * step_hours) as i64);

        let normalized = if hours <= 24 {
            bucket_start
                .with_minute(0)
                .and_then(|dt| dt.with_second(0))
                .and_then(|dt| dt.with_nanosecond(0))
                .unwrap_or(bucket_start)
        } else {
            bucket_start
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .map(|naive| chrono::DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
                .unwrap_or(bucket_start)
        };

        let key = normalized.format(bucket_format).to_string();

        let label = if hours <= 24 {
            normalized.format("%H:%M").to_string()
        } else {
            normalized.format("%b %d").to_string()
        };

        points.push(ReportTrendPoint {
            bucket_start: normalized,
            label,
            outage_count: *outage_map.get(&key).unwrap_or(&0),
            dns_failure_count: *dns_map.get(&key).unwrap_or(&0),
            internet_http_failure_count: *http_map.get(&key).unwrap_or(&0),
            internet_tcp_failure_count: *tcp_map.get(&key).unwrap_or(&0),
        });
    }

    Ok(points)
}

pub async fn upsert_device(
    pool: &SqlitePool,
    ip_address: &str,
    mac_address: Option<&str>,
    hostname: Option<&str>,
    observed_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    let existing = get_device_by_ip(pool, ip_address).await?;

    match existing {
        None => {
            sqlx::query(
                "INSERT INTO devices (ip_address, mac_address, hostname, first_seen, last_seen)
                 VALUES (?1, ?2, ?3, ?4, ?4)",
            )
            .bind(ip_address)
            .bind(mac_address)
            .bind(hostname)
            .bind(observed_at)
            .execute(pool)
            .await?;

            insert_device_history_event(
                pool,
                ip_address,
                "first_seen",
                None,
                hostname.or(mac_address).or(Some(ip_address)),
                observed_at,
            )
            .await?;
        }
        Some(device) => {
            let old_mac = device.mac_address.clone();
            let old_hostname = device.hostname.clone();

            sqlx::query(
                "INSERT INTO devices (ip_address, mac_address, hostname, first_seen, last_seen)
                 VALUES (?1, ?2, ?3, ?4, ?4)
                 ON CONFLICT(ip_address) DO UPDATE SET
                    mac_address = COALESCE(excluded.mac_address, devices.mac_address),
                    hostname = COALESCE(excluded.hostname, devices.hostname),
                    last_seen = excluded.last_seen",
            )
            .bind(ip_address)
            .bind(mac_address)
            .bind(hostname)
            .bind(observed_at)
            .execute(pool)
            .await?;

            if old_mac.as_deref() != mac_address && mac_address.is_some() {
                insert_device_history_event(
                    pool,
                    ip_address,
                    "mac_changed",
                    old_mac.as_deref(),
                    mac_address,
                    observed_at,
                )
                .await?;
            }

            if old_hostname.as_deref() != hostname && hostname.is_some() {
                insert_device_history_event(
                    pool,
                    ip_address,
                    "hostname_changed",
                    old_hostname.as_deref(),
                    hostname,
                    observed_at,
                )
                .await?;
            }

            let should_emit_seen_again = device
                .last_seen
                .map(|last_seen| (observed_at - last_seen).num_hours() >= 12)
                .unwrap_or(false);

            if should_emit_seen_again {
                insert_device_history_event(
                    pool,
                    ip_address,
                    "seen_again",
                    None,
                    None,
                    observed_at,
                )
                .await?;
            }
        }
    }

    Ok(())
}

pub async fn list_devices(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<Device>> {
    Ok(sqlx::query_as::<_, Device>("SELECT id, ip_address, mac_address, hostname, first_seen, last_seen FROM devices ORDER BY last_seen DESC LIMIT ?1")
        .bind(limit).fetch_all(pool).await?)
}

pub async fn latest_connectivity_check(
    pool: &SqlitePool,
    probe_kind: &str,
) -> anyhow::Result<Option<ConnectivityCheck>> {
    Ok(sqlx::query_as::<_, ConnectivityCheck>(
        "SELECT id, timestamp, target, target_type, success, latency_ms, packet_loss_pct, error_message, probe_kind
         FROM connectivity_checks
         WHERE probe_kind = ?1
         ORDER BY timestamp DESC
         LIMIT 1",
    )
    .bind(probe_kind)
    .fetch_optional(pool)
    .await?)
}

pub async fn last_successful_connectivity_check(
    pool: &SqlitePool,
    probe_kind: &str,
) -> anyhow::Result<Option<ConnectivityCheck>> {
    Ok(sqlx::query_as::<_, ConnectivityCheck>(
        "SELECT id, timestamp, target, target_type, success, latency_ms, packet_loss_pct, error_message, probe_kind
         FROM connectivity_checks
         WHERE probe_kind = ?1 AND success = 1
         ORDER BY timestamp DESC
         LIMIT 1",
    )
    .bind(probe_kind)
    .fetch_optional(pool)
    .await?)
}

pub async fn last_failed_connectivity_check(
    pool: &SqlitePool,
    probe_kind: &str,
) -> anyhow::Result<Option<ConnectivityCheck>> {
    Ok(sqlx::query_as::<_, ConnectivityCheck>(
        "SELECT id, timestamp, target, target_type, success, latency_ms, packet_loss_pct, error_message, probe_kind
         FROM connectivity_checks
         WHERE probe_kind = ?1 AND success = 0
         ORDER BY timestamp DESC
         LIMIT 1",
    )
    .bind(probe_kind)
    .fetch_optional(pool)
    .await?)
}

pub async fn latest_dns_check(pool: &SqlitePool) -> anyhow::Result<Option<DnsCheck>> {
    Ok(sqlx::query_as::<_, DnsCheck>("SELECT id, timestamp, domain, resolver, success, response_time_ms, error_message FROM dns_checks ORDER BY timestamp DESC LIMIT 1")
        .fetch_optional(pool).await?)
}

pub async fn last_successful_dns_check(pool: &SqlitePool) -> anyhow::Result<Option<DnsCheck>> {
    Ok(sqlx::query_as::<_, DnsCheck>("SELECT id, timestamp, domain, resolver, success, response_time_ms, error_message FROM dns_checks WHERE success = 1 ORDER BY timestamp DESC LIMIT 1")
        .fetch_optional(pool).await?)
}

pub async fn last_failed_dns_check(pool: &SqlitePool) -> anyhow::Result<Option<DnsCheck>> {
    Ok(sqlx::query_as::<_, DnsCheck>("SELECT id, timestamp, domain, resolver, success, response_time_ms, error_message FROM dns_checks WHERE success = 0 ORDER BY timestamp DESC LIMIT 1")
        .fetch_optional(pool).await?)
}

pub async fn trailing_connectivity_result_count(
    pool: &SqlitePool,
    probe_kind: &str,
    success: bool,
    limit: i64,
) -> anyhow::Result<i64> {
    let rows = sqlx::query(
        r#"
        SELECT success
        FROM connectivity_checks
        WHERE probe_kind = ?1
        ORDER BY timestamp DESC
        LIMIT ?2
        "#,
    )
    .bind(probe_kind)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut count = 0;

    for row in rows {
        let row_success: bool = row.get("success");
        if row_success == success {
            count += 1;
        } else {
            break;
        }
    }

    Ok(count)
}

pub async fn trailing_dns_result_count(
    pool: &SqlitePool,
    success: bool,
    limit: i64,
) -> anyhow::Result<i64> {
    let rows = sqlx::query(
        r#"
        SELECT success
        FROM dns_checks
        ORDER BY timestamp DESC
        LIMIT ?1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut count = 0;

    for row in rows {
        let row_success: bool = row.get("success");
        if row_success == success {
            count += 1;
        } else {
            break;
        }
    }

    Ok(count)
}

pub async fn get_active_outage(
    pool: &SqlitePool,
    outage_type: &str,
    target: &str,
) -> anyhow::Result<Option<Outage>> {
    Ok(sqlx::query_as::<_, Outage>(
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
    .await?)
}

pub async fn active_outages_count(pool: &SqlitePool) -> anyhow::Result<u32> {
    Ok(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM outages WHERE is_active = 1")
            .fetch_one(pool)
            .await? as u32,
    )
}

pub async fn active_outage_exists(
    pool: &SqlitePool,
    outage_type: &str,
    target: &str,
) -> anyhow::Result<bool> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM outages WHERE outage_type = ?1 AND target = ?2 AND is_active = 1",
    )
    .bind(outage_type)
    .bind(target)
    .fetch_one(pool)
    .await?
        > 0)
}

pub async fn outage_count_since_hours(pool: &SqlitePool, hours: i64) -> anyhow::Result<u32> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM outages WHERE started_at >= datetime('now', '-' || ?1 || ' hours')",
    )
    .bind(hours)
    .fetch_one(pool)
    .await? as u32)
}

pub async fn device_count_seen_since_hours(pool: &SqlitePool, hours: i64) -> anyhow::Result<u32> {
    Ok(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM devices WHERE last_seen IS NOT NULL AND last_seen >= datetime('now', '-' || ?1 || ' hours')")
        .bind(hours).fetch_one(pool).await? as u32)
}

pub async fn most_recent_device_seen(pool: &SqlitePool) -> anyhow::Result<Option<DateTime<Utc>>> {
    let row = sqlx::query(
        "SELECT last_seen FROM devices WHERE last_seen IS NOT NULL ORDER BY last_seen DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;
    match row {
        Some(row) => Ok(Some(row.get("last_seen"))),
        None => Ok(None),
    }
}

pub async fn list_known_devices(pool: &SqlitePool) -> anyhow::Result<Vec<KnownDevice>> {
    Ok(sqlx::query_as::<_, KnownDevice>("SELECT id, ip_address, mac_address, label, notes, created_at, updated_at FROM known_devices ORDER BY label ASC")
        .fetch_all(pool).await?)
}

pub async fn get_alert_by_id(pool: &SqlitePool, alert_id: i64) -> anyhow::Result<Option<Alert>> {
    Ok(sqlx::query_as::<_, Alert>(
        r#"
        SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at, acknowledged_at
        FROM alerts
        WHERE id = ?1
        LIMIT 1
        "#,
    )
    .bind(alert_id)
    .fetch_optional(pool)
    .await?)
}

pub async fn list_alerts_filtered(
    pool: &SqlitePool,
    status: Option<&str>,
    severity: Option<&str>,
    entity_type: Option<&str>,
    search: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<Alert>> {
    let search_term = search
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s));

    Ok(
        sqlx::query_as::<_, Alert>(
            r#"
            SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at, acknowledged_at
            FROM alerts
            WHERE (?1 IS NULL
                   OR (?1 = 'active' AND is_active = 1)
                   OR (?1 = 'resolved' AND is_active = 0))
              AND (?2 IS NULL OR severity = ?2)
              AND (?3 IS NULL OR entity_type = ?3)
              AND (
                    ?4 IS NULL
                    OR message LIKE ?4
                    OR entity_key LIKE ?4
                    OR alert_type LIKE ?4
                  )
            ORDER BY created_at DESC
            LIMIT ?5
            "#,
        )
        .bind(status)
        .bind(severity)
        .bind(entity_type)
        .bind(search_term.as_deref())
        .bind(limit)
        .fetch_all(pool)
        .await?,
    )
}

pub async fn upsert_alert_state(
    pool: &SqlitePool,
    alert_type: &str,
    severity: &str,
    entity_type: &str,
    entity_key: &str,
    message: &str,
    is_active: bool,
    timestamp: DateTime<Utc>,
) -> anyhow::Result<()> {
    let existing = sqlx::query_as::<_, Alert>(
        "SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at, acknowledged_at
         FROM alerts
         WHERE entity_type = ?1 AND entity_key = ?2 AND alert_type = ?3 AND is_active = 1
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(entity_type)
    .bind(entity_key)
    .bind(alert_type)
    .fetch_optional(pool)
    .await?;

    match (is_active, existing) {
        (true, None) => {
            let result = sqlx::query(
                "INSERT INTO alerts (
            alert_type, severity, entity_type, entity_key, message,
            is_active, created_at, resolved_at, acknowledged_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, NULL, NULL)",
            )
            .bind(alert_type)
            .bind(severity)
            .bind(entity_type)
            .bind(entity_key)
            .bind(message)
            .bind(timestamp)
            .execute(pool)
            .await?;

            let alert_id = result.last_insert_rowid();

            insert_alert_history_event(pool, alert_id, "opened", None, Some(severity), timestamp)
                .await?;
        }
        (true, Some(alert)) => {
            if alert.severity != severity || alert.message != message {
                sqlx::query(
                    "UPDATE alerts
                    SET severity = ?1,
                    message = ?2,
                    acknowledged_at = NULL
                    WHERE id = ?3",
                )
                .bind(severity)
                .bind(message)
                .bind(alert.id)
                .execute(pool)
                .await?;
            }

            if alert.severity != severity {
                insert_alert_history_event(
                    pool,
                    alert.id,
                    "severity_changed",
                    Some(alert.severity.as_str()),
                    Some(severity),
                    timestamp,
                )
                .await?;
            }

            if alert.message != message {
                insert_alert_history_event(
                    pool,
                    alert.id,
                    "message_changed",
                    Some(alert.message.as_str()),
                    Some(message),
                    timestamp,
                )
                .await?;
            }
        }
        (false, Some(alert)) => {
            sqlx::query(
                "UPDATE alerts
                 SET is_active = 0, resolved_at = ?1
                 WHERE id = ?2",
            )
            .bind(timestamp)
            .bind(alert.id)
            .execute(pool)
            .await?;

            insert_alert_history_event(
                pool,
                alert.id,
                "resolved",
                Some("active"),
                Some("resolved"),
                timestamp,
            )
            .await?;
        }
        (false, None) => {}
    }

    Ok(())
}

pub async fn acknowledge_alert(
    pool: &SqlitePool,
    alert_id: i64,
    acknowledged_at: DateTime<Utc>,
) -> anyhow::Result<Option<Alert>> {
    let existing = sqlx::query_as::<_, Alert>(
        "SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at, acknowledged_at
         FROM alerts
         WHERE id = ?1
         LIMIT 1",
    )
    .bind(alert_id)
    .fetch_optional(pool)
    .await?;

    let Some(existing_alert) = existing else {
        return Ok(None);
    };

    if !existing_alert.is_active {
        return Ok(Some(existing_alert));
    }

    if existing_alert.acknowledged_at.is_some() {
        return Ok(Some(existing_alert));
    }

    sqlx::query(
        "UPDATE alerts
         SET acknowledged_at = ?1
         WHERE id = ?2 AND is_active = 1 AND acknowledged_at IS NULL",
    )
    .bind(acknowledged_at)
    .bind(alert_id)
    .execute(pool)
    .await?;

    insert_alert_history_event(
        pool,
        alert_id,
        "acknowledged",
        None,
        Some("acknowledged"),
        acknowledged_at,
    )
    .await?;

    let updated = sqlx::query_as::<_, Alert>(
        "SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at, acknowledged_at
         FROM alerts
         WHERE id = ?1
         LIMIT 1",
    )
    .bind(alert_id)
    .fetch_one(pool)
    .await?;

    Ok(Some(updated))
}

pub async fn insert_alert_history_event(
    pool: &SqlitePool,
    alert_id: i64,
    event_type: &str,
    previous_value: Option<&str>,
    new_value: Option<&str>,
    created_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO alert_history (
            alert_id,
            event_type,
            previous_value,
            new_value,
            created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(alert_id)
    .bind(event_type)
    .bind(previous_value)
    .bind(new_value)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_alert_history(
    pool: &SqlitePool,
    alert_id: i64,
    limit: i64,
) -> anyhow::Result<Vec<crate::models::AlertHistoryEvent>> {
    Ok(sqlx::query_as::<_, crate::models::AlertHistoryEvent>(
        r#"
            SELECT id, alert_id, event_type, previous_value, new_value, created_at
            FROM alert_history
            WHERE alert_id = ?1
            ORDER BY created_at DESC, id DESC
            LIMIT ?2
            "#,
    )
    .bind(alert_id)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn recent_alert_events(
    pool: &SqlitePool,
    hours: i64,
    limit: i64,
) -> anyhow::Result<Vec<RecentAlertEventItem>> {
    let rows = sqlx::query(
        r#"
        SELECT
            ah.alert_id,
            a.alert_type,
            a.severity,
            a.entity_type,
            a.entity_key,
            a.message,
            ah.event_type,
            ah.previous_value,
            ah.new_value,
            ah.created_at
        FROM alert_history ah
        JOIN alerts a ON a.id = ah.alert_id
        WHERE ah.created_at >= datetime('now', '-' || ?1 || ' hours')
        ORDER BY ah.created_at DESC, ah.id DESC
        LIMIT ?2
        "#,
    )
    .bind(hours)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| RecentAlertEventItem {
            alert_id: row.get("alert_id"),
            alert_type: row.get("alert_type"),
            severity: row.get("severity"),
            entity_type: row.get("entity_type"),
            entity_key: row.get("entity_key"),
            message: row.get("message"),
            event_type: row.get("event_type"),
            previous_value: row.try_get("previous_value").ok(),
            new_value: row.try_get("new_value").ok(),
            created_at: row.get("created_at"),
        })
        .collect())
}

pub async fn active_alerts_count(pool: &SqlitePool) -> anyhow::Result<u32> {
    Ok(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM alerts WHERE is_active = 1")
            .fetch_one(pool)
            .await? as u32,
    )
}

pub async fn active_critical_alerts_count(pool: &SqlitePool) -> anyhow::Result<u32> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM alerts WHERE is_active = 1 AND severity = 'critical'",
    )
    .fetch_one(pool)
    .await? as u32)
}

pub async fn active_unacknowledged_alerts_count(pool: &SqlitePool) -> anyhow::Result<u32> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM alerts WHERE is_active = 1 AND acknowledged_at IS NULL",
    )
    .fetch_one(pool)
    .await? as u32)
}

pub async fn active_unacknowledged_critical_alerts_count(pool: &SqlitePool) -> anyhow::Result<u32> {
    Ok(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM alerts WHERE is_active = 1 AND severity = 'critical' AND acknowledged_at IS NULL",
        )
        .fetch_one(pool)
        .await? as u32,
    )
}

pub async fn most_recent_alert_created_at(
    pool: &SqlitePool,
) -> anyhow::Result<Option<DateTime<Utc>>> {
    let row = sqlx::query("SELECT created_at FROM alerts ORDER BY created_at DESC LIMIT 1")
        .fetch_optional(pool)
        .await?;

    match row {
        Some(row) => Ok(Some(row.get("created_at"))),
        None => Ok(None),
    }
}

pub async fn find_known_device_by_identity(
    pool: &SqlitePool,
    ip_address: Option<&str>,
    mac_address: Option<&str>,
) -> anyhow::Result<Option<KnownDevice>> {
    let row = sqlx::query_as::<_, KnownDevice>(
        r#"
        SELECT id, ip_address, mac_address, label, notes, created_at, updated_at
        FROM known_devices
        WHERE (?1 IS NOT NULL AND ip_address = ?1)
           OR (?2 IS NOT NULL AND mac_address = ?2)
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(ip_address)
    .bind(mac_address)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn save_known_device(
    pool: &SqlitePool,
    ip_address: Option<&str>,
    mac_address: Option<&str>,
    label: &str,
    notes: Option<&str>,
) -> anyhow::Result<KnownDevice> {
    let now = Utc::now();

    if let Some(existing) = find_known_device_by_identity(pool, ip_address, mac_address).await? {
        sqlx::query(
            r#"
            UPDATE known_devices
            SET ip_address = COALESCE(?1, ip_address),
                mac_address = COALESCE(?2, mac_address),
                label = ?3,
                notes = ?4,
                updated_at = ?5
            WHERE id = ?6
            "#,
        )
        .bind(ip_address)
        .bind(mac_address)
        .bind(label)
        .bind(notes)
        .bind(now)
        .bind(existing.id)
        .execute(pool)
        .await?;

        if existing.label != label {
            insert_device_history_event(
                pool,
                existing
                    .ip_address
                    .as_deref()
                    .or(ip_address)
                    .unwrap_or("unknown"),
                "label_changed",
                Some(existing.label.as_str()),
                Some(label),
                now,
            )
            .await?;
        }

        let old_notes = existing
            .notes
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let new_notes = notes.map(str::trim).filter(|s| !s.is_empty());

        if old_notes != new_notes {
            insert_device_history_event(
                pool,
                existing
                    .ip_address
                    .as_deref()
                    .or(ip_address)
                    .unwrap_or("unknown"),
                "notes_changed",
                old_notes,
                new_notes,
                now,
            )
            .await?;
        }

        let updated = sqlx::query_as::<_, KnownDevice>(
            r#"
            SELECT id, ip_address, mac_address, label, notes, created_at, updated_at
            FROM known_devices
            WHERE id = ?1
            "#,
        )
        .bind(existing.id)
        .fetch_one(pool)
        .await?;

        Ok(updated)
    } else {
        let result = sqlx::query(
            r#"
            INSERT INTO known_devices (ip_address, mac_address, label, notes, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            "#,
        )
        .bind(ip_address)
        .bind(mac_address)
        .bind(label)
        .bind(notes)
        .bind(now)
        .execute(pool)
        .await?;

        let inserted = sqlx::query_as::<_, KnownDevice>(
            r#"
            SELECT id, ip_address, mac_address, label, notes, created_at, updated_at
            FROM known_devices
            WHERE id = ?1
            "#,
        )
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await?;

        if let Some(ip) = inserted.ip_address.as_deref().or(ip_address) {
            insert_device_history_event(
                pool,
                ip,
                "label_added",
                None,
                Some(inserted.label.as_str()),
                now,
            )
            .await?;
        }

        Ok(inserted)
    }
}

pub async fn prune_stale_devices(pool: &SqlitePool, older_than_hours: i64) -> anyhow::Result<u64> {
    let result = sqlx::query(
        r#"
        DELETE FROM devices
        WHERE last_seen IS NOT NULL
          AND last_seen < datetime('now', '-' || ?1 || ' hours')
          AND ip_address NOT IN (
              SELECT ip_address
              FROM known_devices
              WHERE ip_address IS NOT NULL
          )
        "#,
    )
    .bind(older_than_hours)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn insert_device_history_event(
    pool: &SqlitePool,
    device_ip_address: &str,
    event_type: &str,
    previous_value: Option<&str>,
    new_value: Option<&str>,
    created_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO device_history (
            device_ip_address,
            event_type,
            previous_value,
            new_value,
            created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(device_ip_address)
    .bind(event_type)
    .bind(previous_value)
    .bind(new_value)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_device_by_ip(
    pool: &SqlitePool,
    ip_address: &str,
) -> anyhow::Result<Option<Device>> {
    Ok(sqlx::query_as::<_, Device>(
        r#"
        SELECT id, ip_address, mac_address, hostname, first_seen, last_seen
        FROM devices
        WHERE ip_address = ?1
        LIMIT 1
        "#,
    )
    .bind(ip_address)
    .fetch_optional(pool)
    .await?)
}

pub async fn list_device_history(
    pool: &SqlitePool,
    ip_address: &str,
    limit: i64,
) -> anyhow::Result<Vec<DeviceHistoryEvent>> {
    Ok(sqlx::query_as::<_, DeviceHistoryEvent>(
        r#"
        SELECT id, device_ip_address, event_type, previous_value, new_value, created_at
        FROM device_history
        WHERE device_ip_address = ?1
        ORDER BY created_at DESC
        LIMIT ?2
        "#,
    )
    .bind(ip_address)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn recent_device_events(
    pool: &SqlitePool,
    hours: i64,
    limit: i64,
) -> anyhow::Result<Vec<RecentDeviceEventItem>> {
    let rows = sqlx::query(
        r#"
        SELECT device_ip_address, event_type, previous_value, new_value, created_at
        FROM device_history
        WHERE created_at >= datetime('now', '-' || ?1 || ' hours')
        ORDER BY created_at DESC, id DESC
        LIMIT ?2
        "#,
    )
    .bind(hours)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| RecentDeviceEventItem {
            device_ip_address: row.get("device_ip_address"),
            event_type: row.get("event_type"),
            previous_value: row.try_get("previous_value").ok(),
            new_value: row.try_get("new_value").ok(),
            created_at: row.get("created_at"),
        })
        .collect())
}

pub async fn top_incident_targets(
    pool: &SqlitePool,
    hours: i64,
    limit: i64,
) -> anyhow::Result<Vec<IncidentTargetSummaryItem>> {
    let rows = sqlx::query(
        r#"
        SELECT
            outage_type AS incident_type,
            target,
            COUNT(*) AS count,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
            COALESCE(SUM(
                CAST(
                    (julianday(COALESCE(ended_at, CURRENT_TIMESTAMP)) - julianday(started_at)) * 86400
                    AS INTEGER
                )
            ), 0) AS total_downtime_seconds,
            MAX(started_at) AS latest_started_at
        FROM outages
        WHERE started_at >= datetime('now', '-' || ?1 || ' hours')
        GROUP BY outage_type, target
        ORDER BY count DESC, total_downtime_seconds DESC, latest_started_at DESC
        LIMIT ?2
        "#,
    )
    .bind(hours)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| IncidentTargetSummaryItem {
            incident_type: row.get("incident_type"),
            target: row.get("target"),
            count: row.get::<i64, _>("count") as u32,
            active_count: row.get::<i64, _>("active_count") as u32,
            total_downtime_seconds: row.get::<i64, _>("total_downtime_seconds"),
            latest_started_at: row.try_get("latest_started_at").ok(),
        })
        .collect())
}

pub async fn insert_wifi_sample(
    pool: &SqlitePool,
    location_label: &str,
    interface_name: &str,
    ssid: Option<&str>,
    bssid: Option<&str>,
    rssi_dbm: Option<i64>,
    frequency_mhz: Option<i64>,
    band: Option<&str>,
    sampled_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO wifi_samples (
            location_label,
            interface_name,
            ssid,
            bssid,
            rssi_dbm,
            frequency_mhz,
            band,
            sampled_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
    )
    .bind(location_label)
    .bind(interface_name)
    .bind(ssid)
    .bind(bssid)
    .bind(rssi_dbm)
    .bind(frequency_mhz)
    .bind(band)
    .bind(sampled_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn latest_wifi_sample(pool: &SqlitePool) -> anyhow::Result<Option<WifiSample>> {
    Ok(sqlx::query_as::<_, WifiSample>(
        r#"
        SELECT
            id,
            location_label,
            interface_name,
            ssid,
            bssid,
            rssi_dbm,
            frequency_mhz,
            band,
            sampled_at
        FROM wifi_samples
        ORDER BY sampled_at DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn list_wifi_samples_filtered(
    pool: &SqlitePool,
    minutes: i64,
    location_label: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<WifiSample>> {
    Ok(sqlx::query_as::<_, WifiSample>(
        r#"
        SELECT
            id,
            location_label,
            interface_name,
            ssid,
            bssid,
            rssi_dbm,
            frequency_mhz,
            band,
            sampled_at
        FROM wifi_samples
        WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
        AND (?2 IS NULL OR location_label = ?2)
        ORDER BY sampled_at DESC
        LIMIT ?3
        "#,
    )
    .bind(minutes)
    .bind(location_label)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn list_wifi_locations(pool: &SqlitePool) -> anyhow::Result<Vec<String>> {
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT location_label
        FROM wifi_samples
        WHERE location_label IS NOT NULL
          AND TRIM(location_label) != ''
        ORDER BY location_label ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("location_label").ok())
        .collect())
}

pub async fn wifi_summary(
    pool: &SqlitePool,
    minutes: i64,
    location_label: Option<&str>,
) -> anyhow::Result<(
    Option<WifiSample>,
    u32,
    Option<f64>,
    Option<i64>,
    Option<i64>,
)> {
    let (latest, row) = if let Some(location_label) = location_label {
        let latest = sqlx::query_as::<_, WifiSample>(
            r#"
            SELECT
                id,
                location_label,
                interface_name,
                ssid,
                bssid,
                rssi_dbm,
                frequency_mhz,
                band,
                sampled_at
            FROM wifi_samples
            WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
              AND location_label = ?2
            ORDER BY sampled_at DESC
            LIMIT 1
            "#,
        )
        .bind(minutes)
        .bind(location_label)
        .fetch_optional(pool)
        .await?;

        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) AS sample_count,
                AVG(rssi_dbm) AS avg_rssi_dbm,
                MIN(rssi_dbm) AS min_rssi_dbm,
                MAX(rssi_dbm) AS max_rssi_dbm
            FROM wifi_samples
            WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
              AND location_label = ?2
            "#,
        )
        .bind(minutes)
        .bind(location_label)
        .fetch_one(pool)
        .await?;

        (latest, row)
    } else {
        let latest = sqlx::query_as::<_, WifiSample>(
            r#"
            SELECT
                id,
                location_label,
                interface_name,
                ssid,
                bssid,
                rssi_dbm,
                frequency_mhz,
                band,
                sampled_at
            FROM wifi_samples
            WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
            ORDER BY sampled_at DESC
            LIMIT 1
            "#,
        )
        .bind(minutes)
        .fetch_optional(pool)
        .await?;

        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) AS sample_count,
                AVG(rssi_dbm) AS avg_rssi_dbm,
                MIN(rssi_dbm) AS min_rssi_dbm,
                MAX(rssi_dbm) AS max_rssi_dbm
            FROM wifi_samples
            WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
            "#,
        )
        .bind(minutes)
        .fetch_one(pool)
        .await?;

        (latest, row)
    };

    let sample_count: i64 = row.get("sample_count");
    let avg_rssi_dbm: Option<f64> = row.try_get("avg_rssi_dbm").ok();
    let min_rssi_dbm: Option<i64> = row.try_get("min_rssi_dbm").ok();
    let max_rssi_dbm: Option<i64> = row.try_get("max_rssi_dbm").ok();

    Ok((
        latest,
        sample_count as u32,
        avg_rssi_dbm,
        min_rssi_dbm,
        max_rssi_dbm,
    ))
}

pub async fn wifi_location_summaries(
    pool: &SqlitePool,
    minutes: i64,
) -> anyhow::Result<
    Vec<(
        String,
        Option<WifiSample>,
        u32,
        Option<f64>,
        Option<i64>,
        Option<i64>,
    )>,
> {
    let locations = list_wifi_locations(pool).await?;
    let mut items = Vec::with_capacity(locations.len());

    for location in locations {
        let (latest_sample, sample_count, avg_rssi_dbm, min_rssi_dbm, max_rssi_dbm) =
            wifi_summary(pool, minutes, Some(location.as_str())).await?;

        items.push((
            location,
            latest_sample,
            sample_count,
            avg_rssi_dbm,
            min_rssi_dbm,
            max_rssi_dbm,
        ));
    }

    Ok(items)
}

pub async fn latest_wifi_sample_for_location(
    pool: &SqlitePool,
    location_label: &str,
) -> anyhow::Result<Option<WifiSample>> {
    Ok(sqlx::query_as::<_, WifiSample>(
        r#"
        SELECT
            id,
            location_label,
            interface_name,
            ssid,
            bssid,
            rssi_dbm,
            frequency_mhz,
            band,
            sampled_at
        FROM wifi_samples
        WHERE location_label = ?1
        ORDER BY sampled_at DESC
        LIMIT 1
        "#,
    )
    .bind(location_label)
    .fetch_optional(pool)
    .await?)
}

pub async fn wifi_minutes_since_last_sample(
    pool: &SqlitePool,
    location_label: &str,
) -> anyhow::Result<Option<i64>> {
    let row = sqlx::query(
        r#"
        SELECT sampled_at
        FROM wifi_samples
        WHERE location_label = ?1
        ORDER BY sampled_at DESC
        LIMIT 1
        "#,
    )
    .bind(location_label)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let sampled_at: chrono::DateTime<chrono::Utc> = row.get("sampled_at");
    Ok(Some((Utc::now() - sampled_at).num_minutes()))
}

pub async fn insert_traffic_sample(
    pool: &SqlitePool,
    interface_name: &str,
    entity_type: &str,
    entity_key: &str,
    device_ip_address: Option<&str>,
    mac_address: Option<&str>,
    bytes_rx: i64,
    bytes_tx: i64,
    packets_rx: Option<i64>,
    packets_tx: Option<i64>,
    sampled_at: DateTime<Utc>,
) -> anyhow::Result<i64> {
    let result = sqlx::query(
        r#"
        INSERT INTO traffic_samples (
            interface_name,
            entity_type,
            entity_key,
            device_ip_address,
            mac_address,
            bytes_rx,
            bytes_tx,
            packets_rx,
            packets_tx,
            sampled_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
    )
    .bind(interface_name)
    .bind(entity_type)
    .bind(entity_key)
    .bind(device_ip_address)
    .bind(mac_address)
    .bind(bytes_rx)
    .bind(bytes_tx)
    .bind(packets_rx)
    .bind(packets_tx)
    .bind(sampled_at)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn list_traffic_samples(
    pool: &SqlitePool,
    minutes: i64,
    limit: i64,
) -> anyhow::Result<Vec<TrafficSample>> {
    let items = sqlx::query_as::<_, TrafficSample>(
        r#"
        SELECT
            id,
            interface_name,
            entity_type,
            entity_key,
            device_ip_address,
            mac_address,
            bytes_rx,
            bytes_tx,
            packets_rx,
            packets_tx,
            sampled_at
        FROM traffic_samples
        WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
        ORDER BY sampled_at DESC
        LIMIT ?2
        "#,
    )
    .bind(minutes)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(items)
}

pub async fn traffic_top_talkers(
    pool: &SqlitePool,
    minutes: i64,
    limit: i64,
) -> anyhow::Result<Vec<TrafficTopTalkerItem>> {
    let rows = sqlx::query(
        r#"
        WITH windowed AS (
            SELECT *
            FROM traffic_samples
            WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
        ),
        ranked AS (
            SELECT
                interface_name,
                entity_type,
                entity_key,
                device_ip_address,
                mac_address,
                bytes_rx,
                bytes_tx,
                sampled_at,
                ROW_NUMBER() OVER (
                    PARTITION BY interface_name, entity_key
                    ORDER BY datetime(sampled_at) ASC
                ) AS rn_asc,
                ROW_NUMBER() OVER (
                    PARTITION BY interface_name, entity_key
                    ORDER BY datetime(sampled_at) DESC
                ) AS rn_desc
            FROM windowed
        ),
        earliest AS (
            SELECT
                interface_name,
                entity_type,
                entity_key,
                device_ip_address,
                mac_address,
                bytes_rx AS earliest_bytes_rx,
                bytes_tx AS earliest_bytes_tx
            FROM ranked
            WHERE rn_asc = 1
        ),
        latest AS (
            SELECT
                interface_name,
                entity_type,
                entity_key,
                device_ip_address,
                mac_address,
                bytes_rx AS latest_bytes_rx,
                bytes_tx AS latest_bytes_tx,
                sampled_at AS latest_sampled_at
            FROM ranked
            WHERE rn_desc = 1
        )
        SELECT
            latest.interface_name,
            latest.entity_type,
            latest.entity_key,
            latest.device_ip_address,
            latest.mac_address,
            latest.latest_bytes_rx,
            latest.latest_bytes_tx,
            earliest.earliest_bytes_rx,
            earliest.earliest_bytes_tx,
            (latest.latest_bytes_rx - earliest.earliest_bytes_rx) AS delta_bytes_rx,
            (latest.latest_bytes_tx - earliest.earliest_bytes_tx) AS delta_bytes_tx,
            ((latest.latest_bytes_rx - earliest.earliest_bytes_rx) +
             (latest.latest_bytes_tx - earliest.earliest_bytes_tx)) AS delta_bytes_total,
            latest.latest_sampled_at
        FROM latest
        JOIN earliest
          ON earliest.interface_name = latest.interface_name
         AND earliest.entity_key = latest.entity_key
        ORDER BY delta_bytes_total DESC, latest.latest_sampled_at DESC
        LIMIT ?2
        "#,
    )
    .bind(minutes)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|row| TrafficTopTalkerItem {
            interface_name: row.get("interface_name"),
            entity_type: row.get("entity_type"),
            entity_key: row.get("entity_key"),
            device_ip_address: row.try_get("device_ip_address").ok(),
            mac_address: row.try_get("mac_address").ok(),
            latest_bytes_rx: row.get("latest_bytes_rx"),
            latest_bytes_tx: row.get("latest_bytes_tx"),
            earliest_bytes_rx: row.get("earliest_bytes_rx"),
            earliest_bytes_tx: row.get("earliest_bytes_tx"),
            delta_bytes_rx: row.get("delta_bytes_rx"),
            delta_bytes_tx: row.get("delta_bytes_tx"),
            delta_bytes_total: row.get("delta_bytes_total"),
            latest_sampled_at: row.get("latest_sampled_at"),
        })
        .collect();

    Ok(items)
}

pub async fn traffic_summary(
    pool: &SqlitePool,
    minutes: i64,
) -> anyhow::Result<(i64, i64, u32, Option<TrafficTopTalkerItem>)> {
    let row = sqlx::query(
        r#"
        SELECT
            COALESCE(SUM(bytes_rx), 0) AS total_bytes_rx,
            COALESCE(SUM(bytes_tx), 0) AS total_bytes_tx,
            COUNT(DISTINCT interface_name) AS interface_count
        FROM traffic_samples
        WHERE datetime(sampled_at) >= datetime('now', '-' || ?1 || ' minutes')
        "#,
    )
    .bind(minutes)
    .fetch_one(pool)
    .await?;

    let total_bytes_rx: i64 = row.get("total_bytes_rx");
    let total_bytes_tx: i64 = row.get("total_bytes_tx");
    let interface_count: i64 = row.get("interface_count");

    let top_talker = traffic_top_talkers(pool, minutes, 1)
        .await?
        .into_iter()
        .next();

    Ok((
        total_bytes_rx,
        total_bytes_tx,
        interface_count as u32,
        top_talker,
    ))
}

pub async fn create_capture_export_request(
    pool: &SqlitePool,
    request: &CreateCaptureExportRequest,
    created_at: DateTime<Utc>,
) -> anyhow::Result<CaptureExportRequest> {
    let result = sqlx::query(
        r#"
        INSERT INTO capture_export_requests (
            source,
            interface_name,
            entity_type,
            entity_key,
            device_ip_address,
            mac_address,
            window_minutes,
            note,
            status,
            capture_reference,
            created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'requested', NULL, ?9)
        "#,
    )
    .bind(request.source.trim())
    .bind(request.interface_name.as_deref())
    .bind(request.entity_type.as_deref())
    .bind(request.entity_key.as_deref())
    .bind(request.device_ip_address.as_deref())
    .bind(request.mac_address.as_deref())
    .bind(request.window_minutes)
    .bind(request.note.as_deref())
    .bind(created_at)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();

    let item = sqlx::query_as::<_, CaptureExportRequest>(
        r#"
        SELECT
            id,
            source,
            interface_name,
            entity_type,
            entity_key,
            device_ip_address,
            mac_address,
            window_minutes,
            note,
            status,
            capture_reference,
            created_at
        FROM capture_export_requests
        WHERE id = ?1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(item)
}

pub async fn list_capture_export_requests(
    pool: &SqlitePool,
    limit: i64,
) -> anyhow::Result<Vec<CaptureExportRequest>> {
    let items = sqlx::query_as::<_, CaptureExportRequest>(
        r#"
        SELECT
            id,
            source,
            interface_name,
            entity_type,
            entity_key,
            device_ip_address,
            mac_address,
            window_minutes,
            note,
            status,
            capture_reference,
            created_at
        FROM capture_export_requests
        ORDER BY datetime(created_at) DESC
        LIMIT ?1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(items)
}
