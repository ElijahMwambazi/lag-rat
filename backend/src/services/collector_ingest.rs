use crate::{
    db,
    models::{
        CollectorObservation, DeviceObservation, DnsObservation, ServiceObservation,
        TrafficObservation, WifiObservation,
    },
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
        CollectorObservation::Wifi(observation) => ingest_wifi(state, &observation).await,
        CollectorObservation::Traffic(observation) => ingest_traffic(state, &observation).await,
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

async fn ingest_wifi(state: &AppState, observation: &WifiObservation) -> anyhow::Result<()> {
    debug!(
        module = %observation.module,
        collector_type = %observation.collector_type,
        entity_type = %observation.entity_type,
        entity_key = %observation.entity_key,
        location_label = %observation.location_label,
        "ingesting wifi observation",
    );

    db::insert_wifi_sample(
        &state.db,
        &observation.location_label,
        &observation.interface_name,
        observation.ssid.as_deref(),
        observation.bssid.as_deref(),
        observation.rssi_dbm,
        observation.frequency_mhz,
        observation.band.as_deref(),
        observation.observed_at,
    )
    .await?;

    alerts::evaluate_wifi_observation(state, observation).await?;
    alerts::evaluate_all_wifi_sample_freshness(state).await?;

    Ok(())
}

async fn ingest_traffic(state: &AppState, observation: &TrafficObservation) -> anyhow::Result<()> {
    debug!(
        module = %observation.module,
        collector_type = %observation.collector_type,
        interface_name = %observation.interface_name,
        entity_type = %observation.entity_type,
        entity_key = %observation.entity_key,
        bytes_rx = observation.bytes_rx,
        bytes_tx = observation.bytes_tx,
        "ingesting traffic observation",
    );

    db::insert_traffic_sample(
        &state.db,
        &observation.interface_name,
        &observation.entity_type,
        &observation.entity_key,
        observation.device_ip_address.as_deref(),
        observation.mac_address.as_deref(),
        observation.bytes_rx,
        observation.bytes_tx,
        observation.packets_rx,
        observation.packets_tx,
        observation.observed_at,
    )
    .await?;

    Ok(())
}
