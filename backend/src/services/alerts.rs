use chrono::Utc;

use crate::{db, monitors::connectivity::ProbeResult, state::AppState};

const FAILURES_TO_OPEN: i64 = 2;
const SUCCESSES_TO_RESOLVE: i64 = 2;
const LOOKBACK_LIMIT: i64 = 10;

pub async fn evaluate_connectivity(
    state: &AppState,
    service: &str,
    entity_key: &str,
    probe: &ProbeResult,
) -> anyhow::Result<()> {
    let trailing_failures =
        db::trailing_connectivity_result_count(&state.db, service, false, LOOKBACK_LIMIT).await?;

    let trailing_successes =
        db::trailing_connectivity_result_count(&state.db, service, true, LOOKBACK_LIMIT).await?;

    if !probe.success && trailing_failures >= FAILURES_TO_OPEN {
        let message = match &probe.error_message {
            Some(err) => format!("{service} check failed: {err}"),
            None => format!("{service} check failed"),
        };

        db::upsert_alert_state(
            &state.db,
            "service_health",
            "critical",
            service,
            entity_key,
            &message,
            true,
            Utc::now(),
        )
        .await?;
    } else if probe.success && trailing_successes >= SUCCESSES_TO_RESOLVE {
        let message = format!("{service} check recovered");

        db::upsert_alert_state(
            &state.db,
            "service_health",
            "info",
            service,
            entity_key,
            &message,
            false,
            Utc::now(),
        )
        .await?;
    }

    Ok(())
}

pub async fn evaluate_dns(
    state: &AppState,
    domain: &str,
    success: bool,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    let trailing_failures = db::trailing_dns_result_count(&state.db, false, LOOKBACK_LIMIT).await?;

    let trailing_successes = db::trailing_dns_result_count(&state.db, true, LOOKBACK_LIMIT).await?;

    if !success && trailing_failures >= FAILURES_TO_OPEN {
        let message = match error_message {
            Some(err) => format!("dns check failed for {domain}: {err}"),
            None => format!("dns check failed for {domain}"),
        };

        db::upsert_alert_state(
            &state.db,
            "dns_health",
            "critical",
            "dns",
            domain,
            &message,
            true,
            Utc::now(),
        )
        .await?;
    } else if success && trailing_successes >= SUCCESSES_TO_RESOLVE {
        let message = format!("dns check recovered for {domain}");

        db::upsert_alert_state(
            &state.db,
            "dns_health",
            "info",
            "dns",
            domain,
            &message,
            false,
            Utc::now(),
        )
        .await?;
    }

    Ok(())
}
