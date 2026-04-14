use chrono::Utc;

use crate::{
    db,
    models::{DnsObservation, ServiceObservation},
    state::AppState,
};

const FAILURES_TO_OPEN: i64 = 2;
const SUCCESSES_TO_RESOLVE: i64 = 2;
const LOOKBACK_LIMIT: i64 = 10;
const CRITICAL_AFTER_MINUTES: i64 = 5;

pub async fn evaluate_service_observation(
    state: &AppState,
    observation: &ServiceObservation,
) -> anyhow::Result<()> {
    let trailing_failures = db::trailing_connectivity_result_count(
        &state.db,
        &observation.collector_type,
        false,
        LOOKBACK_LIMIT,
    )
    .await?;

    let trailing_successes = db::trailing_connectivity_result_count(
        &state.db,
        &observation.collector_type,
        true,
        LOOKBACK_LIMIT,
    )
    .await?;

    if !observation.success && trailing_failures >= FAILURES_TO_OPEN {
        let active_outage = db::get_active_outage(
            &state.db,
            &observation.collector_type,
            &observation.entity_key,
        )
        .await?;

        let outage_age_minutes = active_outage
            .as_ref()
            .map(|outage| (Utc::now() - outage.started_at).num_minutes())
            .unwrap_or(0);

        let is_critical = outage_age_minutes >= CRITICAL_AFTER_MINUTES;
        let severity = if is_critical { "critical" } else { "warning" };

        let message = match &observation.error_message {
            Some(err) if is_critical => {
                format!(
                    "{} still failing after {}m: {}",
                    observation.collector_type, outage_age_minutes, err
                )
            }
            Some(err) => {
                format!("{} check failed: {}", observation.collector_type, err)
            }
            None if is_critical => {
                format!(
                    "{} still failing after {}m",
                    observation.collector_type, outage_age_minutes
                )
            }
            None => format!("{} check failed", observation.collector_type),
        };

        db::upsert_alert_state(
            &state.db,
            "service_health",
            severity,
            &observation.entity_type,
            &observation.entity_key,
            &message,
            true,
            Utc::now(),
        )
        .await?;
    } else if observation.success && trailing_successes >= SUCCESSES_TO_RESOLVE {
        let message = format!("{} check recovered", observation.collector_type);

        db::upsert_alert_state(
            &state.db,
            "service_health",
            "info",
            &observation.entity_type,
            &observation.entity_key,
            &message,
            false,
            Utc::now(),
        )
        .await?;
    }

    Ok(())
}

pub async fn evaluate_dns_observation(
    state: &AppState,
    observation: &DnsObservation,
) -> anyhow::Result<()> {
    let trailing_failures = db::trailing_dns_result_count(&state.db, false, LOOKBACK_LIMIT).await?;

    let trailing_successes = db::trailing_dns_result_count(&state.db, true, LOOKBACK_LIMIT).await?;

    if !observation.success && trailing_failures >= FAILURES_TO_OPEN {
        let active_outage =
            db::get_active_outage(&state.db, "dns", &observation.entity_key).await?;

        let outage_age_minutes = active_outage
            .as_ref()
            .map(|outage| (Utc::now() - outage.started_at).num_minutes())
            .unwrap_or(0);

        let is_critical = outage_age_minutes >= CRITICAL_AFTER_MINUTES;
        let severity = if is_critical { "critical" } else { "warning" };

        let message = match observation.error_message.as_deref() {
            Some(err) if is_critical => {
                format!(
                    "dns still failing for {} after {}m: {}",
                    observation.domain, outage_age_minutes, err
                )
            }
            Some(err) => {
                format!("dns check failed for {}: {}", observation.domain, err)
            }
            None if is_critical => {
                format!(
                    "dns still failing for {} after {}m",
                    observation.domain, outage_age_minutes
                )
            }
            None => format!("dns check failed for {}", observation.domain),
        };

        db::upsert_alert_state(
            &state.db,
            "dns_health",
            severity,
            observation.entity_type,
            &observation.entity_key,
            &message,
            true,
            Utc::now(),
        )
        .await?;
    } else if observation.success && trailing_successes >= SUCCESSES_TO_RESOLVE {
        let message = format!("dns check recovered for {}", observation.domain);

        db::upsert_alert_state(
            &state.db,
            "dns_health",
            "info",
            observation.entity_type,
            &observation.entity_key,
            &message,
            false,
            Utc::now(),
        )
        .await?;
    }

    Ok(())
}

#[allow(dead_code)]
pub async fn evaluate_connectivity(
    state: &AppState,
    service: &str,
    entity_key: &str,
    probe: &crate::monitors::connectivity::ProbeResult,
) -> anyhow::Result<()> {
    let observation = ServiceObservation {
        module: "home_network".to_string(),
        collector_type: service.to_string(),
        target: entity_key.to_string(),
        target_type: if service == "router_tcp" {
            "router".to_string()
        } else {
            "internet".to_string()
        },
        entity_type: service.to_string(),
        entity_key: entity_key.to_string(),
        observed_at: Utc::now(),
        success: probe.success,
        latency_ms: probe.latency_ms,
        error_message: probe.error_message.clone(),
    };

    evaluate_service_observation(state, &observation).await
}

#[allow(dead_code)]
pub async fn evaluate_dns(
    state: &AppState,
    domain: &str,
    success: bool,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    let observation = DnsObservation {
        module: "home_network".to_string(),
        collector_type: "dns_lookup".to_string(),
        domain: domain.to_string(),
        resolver: state.config.dns_resolver.clone(),
        entity_type: "dns",
        entity_key: domain.to_string(),
        observed_at: Utc::now(),
        success,
        response_time_ms: None,
        error_message: error_message.map(str::to_string),
    };

    evaluate_dns_observation(state, &observation).await
}
