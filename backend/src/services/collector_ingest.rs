use crate::{
    db,
    models::{CollectorObservation, DeviceObservation, DnsObservation, ServiceObservation},
    services::alerts,
    state::AppState,
};
use tracing::debug;

pub async fn ingest(state: &AppState, observation: CollectorObservation) -> anyhow::Result<()> {
    match observation {
        CollectorObservation::Connectivity(observation) => {
            ingest_connectivity(state, &observation).await
        }
        CollectorObservation::Dns(observation) => ingest_dns(state, &observation).await,
        CollectorObservation::Device(observation) => ingest_device(state, &observation).await,
    }
}

async fn ingest_connectivity(
    state: &AppState,
    observation: &ServiceObservation,
) -> anyhow::Result<()> {
    debug!(
        module = %observation.module,
        collector_type = %observation.collector_type,
        entity_type = %observation.entity_type,
        entity_key = %observation.entity_key,
        success = observation.success,
        "ingesting connectivity observation",
    );

    db::insert_connectivity_check(
        &state.db,
        observation.observed_at,
        &observation.target,
        &observation.target_type,
        &observation.collector_type,
        observation.success,
        observation.latency_ms,
        observation.error_message.as_deref(),
    )
    .await?;

    alerts::evaluate_service_observation(state, observation).await?;

    Ok(())
}

async fn ingest_dns(state: &AppState, observation: &DnsObservation) -> anyhow::Result<()> {
    debug!(
        module = %observation.module,
        collector_type = %observation.collector_type,
        entity_type = %observation.entity_type,
        entity_key = %observation.entity_key,
        success = observation.success,
        "ingesting dns observation",
    );

    db::insert_dns_check(
        &state.db,
        observation.observed_at,
        &observation.domain,
        &observation.resolver,
        observation.success,
        observation.response_time_ms,
        observation.error_message.as_deref(),
    )
    .await?;

    alerts::evaluate_dns_observation(state, observation).await?;

    Ok(())
}

async fn ingest_device(state: &AppState, observation: &DeviceObservation) -> anyhow::Result<()> {
    debug!(
        module = %observation.module,
        collector_type = %observation.collector_type,
        entity_type = %observation.entity_type,
        entity_key = %observation.entity_key,
        "ingesting device observation",
    );

    db::upsert_device(
        &state.db,
        &observation.ip_address,
        observation.mac_address.as_deref(),
        observation.hostname.as_deref(),
        observation.observed_at,
    )
    .await?;

    Ok(())
}
