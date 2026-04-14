use chrono::Utc;
use tokio::process::Command;

use crate::{
    models::{CollectorObservation, WifiObservation},
    services::collector_ingest,
    state::AppState,
};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    if !state.config.wifi_sampling_enabled {
        return Ok(());
    }

    let sampled_at = Utc::now();
    let interface_name = state.config.wifi_interface.clone();
    let location_label = state.config.wifi_location_label.clone();

    let sample = sample_wifi_linux(&interface_name).await?;

    collector_ingest::ingest(
        state,
        CollectorObservation::Wifi(WifiObservation {
            module: "home_network".to_string(),
            collector_type: "wifi_sample".to_string(),
            entity_type: "wifi_network".to_string(),
            entity_key: sample
                .bssid
                .clone()
                .or_else(|| sample.ssid.clone())
                .unwrap_or_else(|| interface_name.clone()),
            location_label,
            interface_name,
            ssid: sample.ssid,
            bssid: sample.bssid,
            rssi_dbm: sample.rssi_dbm,
            frequency_mhz: sample.frequency_mhz,
            band: sample.band,
            observed_at: sampled_at,
        }),
    )
    .await
}

struct LinuxWifiSample {
    ssid: Option<String>,
    bssid: Option<String>,
    rssi_dbm: Option<i64>,
    frequency_mhz: Option<i64>,
    band: Option<String>,
}

async fn sample_wifi_linux(interface_name: &str) -> anyhow::Result<LinuxWifiSample> {
    let output = Command::new("iw")
        .args(["dev", interface_name, "link"])
        .output()
        .await?;

    let text = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        return Ok(LinuxWifiSample {
            ssid: None,
            bssid: None,
            rssi_dbm: None,
            frequency_mhz: None,
            band: None,
        });
    }

    let mut ssid = None;
    let mut bssid = None;
    let mut rssi_dbm = None;
    let mut frequency_mhz = None;

    for line in text.lines().map(str::trim) {
        if let Some(value) = line.strip_prefix("SSID: ") {
            ssid = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("signal: ") {
            let dbm = value
                .split_whitespace()
                .next()
                .and_then(|part| part.parse::<f64>().ok())
                .map(|v| v.round() as i64);
            rssi_dbm = dbm;
        } else if let Some(value) = line.strip_prefix("freq: ") {
            frequency_mhz = value.trim().parse::<i64>().ok();
        } else if line.starts_with("Connected to ") {
            let maybe_bssid = line.trim_start_matches("Connected to ").trim();
            if !maybe_bssid.is_empty() {
                bssid = Some(maybe_bssid.to_string());
            }
        }
    }

    let band = frequency_mhz.map(|mhz| {
        if mhz >= 5900 {
            "6ghz".to_string()
        } else if mhz >= 5000 {
            "5ghz".to_string()
        } else {
            "2.4ghz".to_string()
        }
    });

    Ok(LinuxWifiSample {
        ssid,
        bssid,
        rssi_dbm,
        frequency_mhz,
        band,
    })
}
