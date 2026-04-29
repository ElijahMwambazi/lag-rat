use tokio::time::{interval, Duration};
use tracing::{error, info, warn};

use crate::services::{captures, collector_ingest, traffic};
use crate::{monitors, state::AppState};

pub async fn start(state: AppState) {
    let mut connectivity_tick = interval(Duration::from_secs(
        state.config.connectivity_interval_seconds,
    ));
    let mut dns_tick = interval(Duration::from_secs(state.config.dns_interval_seconds));
    let mut device_tick = interval(Duration::from_secs(state.config.device_interval_seconds));
    let mut wifi_tick = interval(Duration::from_secs(state.config.wifi_interval_seconds));
    let mut traffic_tick = interval(Duration::from_secs(30));
    let mut capture_tick = interval(Duration::from_secs(10));

    info!("scheduler started");

    loop {
        tokio::select! {
            _ = connectivity_tick.tick() => {
                if let Err(err) = monitors::connectivity::run(&state).await {
                    error!(error = %err, "connectivity probe failed");
                }
            }
            _ = dns_tick.tick() => {
                if let Err(err) = monitors::dns::run(&state).await {
                    error!(error = %err, "dns probe failed");
                }
            }
            _ = device_tick.tick() => {
                if let Err(err) = monitors::devices::run(&state).await {
                    error!(error = %err, "device inventory pass failed");
                }
            }
            _ = wifi_tick.tick() => {
                if let Err(err) = monitors::wifi::run(&state).await {
                    error!(error = %err, "wifi probe failed");
                }
            }
            _ = traffic_tick.tick() => {
                match traffic::collect_interface_traffic_snapshots().await {
                    Ok(observations) => {
                        for observation in observations {
                            if let Err(err) =
                                collector_ingest::ingest(&state, observation).await
                            {
                                warn!(error = %err, "failed to ingest traffic observation");
                            }
                        }
                    }
                    Err(err) => {
                        warn!(error = %err, "failed to collect traffic snapshots");
                    }
                }
            }
            _ = capture_tick.tick() => {
                if let Err(err) = captures::process_next_capture_export_request(&state.db).await {
                    error!(error = %err, "failed to process capture export request");
                }
            }
        }
    }
}
