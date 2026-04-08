use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use sqlx::{Row, SqlitePool};

use crate::models::{
    Alert, ConnectivityCheck, Device, DeviceHistoryEvent, DnsCheck, KnownDevice, Outage,
    SummaryResponse, TimeseriesPoint,
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

pub async fn list_outages(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<Outage>> {
    Ok(sqlx::query_as::<_, Outage>("SELECT id, outage_type, target, started_at, ended_at, is_active, start_error, end_note FROM outages ORDER BY started_at DESC LIMIT ?1")
        .bind(limit).fetch_all(pool).await?)
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

pub async fn list_alerts(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<Alert>> {
    Ok(sqlx::query_as::<_, Alert>("SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at FROM alerts ORDER BY created_at DESC LIMIT ?1")
        .bind(limit).fetch_all(pool).await?)
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
            SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at
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
    let existing = sqlx::query_as::<_, Alert>("SELECT id, alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at FROM alerts WHERE entity_type = ?1 AND entity_key = ?2 AND alert_type = ?3 AND is_active = 1 ORDER BY created_at DESC LIMIT 1")
        .bind(entity_type).bind(entity_key).bind(alert_type).fetch_optional(pool).await?;
    match (is_active, existing) {
        (true, None) => {
            sqlx::query("INSERT INTO alerts (alert_type, severity, entity_type, entity_key, message, is_active, created_at, resolved_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, NULL)")
                .bind(alert_type).bind(severity).bind(entity_type).bind(entity_key).bind(message).bind(timestamp)
                .execute(pool).await?;
        }
        (false, Some(alert)) => {
            sqlx::query("UPDATE alerts SET is_active = 0, resolved_at = ?1 WHERE id = ?2")
                .bind(timestamp)
                .bind(alert.id)
                .execute(pool)
                .await?;
        }
        _ => {}
    }
    Ok(())
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
