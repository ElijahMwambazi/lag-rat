use chrono::Utc;

use crate::{
    db,
    models::{EnrichedDevice, KnownDevice},
    state::AppState,
};

pub async fn list_enriched(state: &AppState) -> anyhow::Result<Vec<EnrichedDevice>> {
    let devices = db::list_devices(&state.db, 200).await?;
    let known_devices = db::list_known_devices(&state.db).await?;

    Ok(devices
        .into_iter()
        .map(|device| {
            let known = match_known_device(
                &known_devices,
                Some(device.ip_address.as_str()),
                device.mac_address.as_deref(),
            );

            let is_recent = device
                .last_seen
                .map(|ts| (Utc::now() - ts).num_hours() < 24)
                .unwrap_or(false);

            let is_gateway = device.ip_address == state.config.router_ip;
            let label = known.as_ref().map(|k| k.label.clone());
            let notes = known.as_ref().and_then(|k| k.notes.clone());

            let display_name = label
                .clone()
                .or_else(|| device.hostname.clone())
                .unwrap_or_else(|| device.ip_address.clone());

            let confidence = if is_gateway || device.mac_address.is_some() {
                "high"
            } else if known.is_some() || device.hostname.is_some() {
                "medium"
            } else {
                "low"
            }
            .to_string();

            EnrichedDevice {
                id: device.id,
                ip_address: device.ip_address,
                mac_address: device.mac_address,
                hostname: device.hostname,
                display_name,
                label,
                notes,
                first_seen: device.first_seen,
                last_seen: device.last_seen,
                is_recent,
                is_gateway,
                is_known: known.is_some(),
                confidence,
            }
        })
        .collect())
}

fn match_known_device<'a>(
    known_devices: &'a [KnownDevice],
    ip_address: Option<&str>,
    mac_address: Option<&str>,
) -> Option<&'a KnownDevice> {
    known_devices.iter().find(|known| {
        (ip_address.is_some() && known.ip_address.as_deref() == ip_address)
            || (mac_address.is_some() && known.mac_address.as_deref() == mac_address)
    })
}
