use tokio::time::{interval, Duration};
use tracing::{error, info};

use crate::{monitors, state::AppState};

pub async fn start(state: AppState) {
    let mut connectivity_tick = interval(Duration::from_secs(state.config.connectivity_interval_seconds));
    let mut dns_tick = interval(Duration::from_secs(state.config.dns_interval_seconds));
    let mut device_tick = interval(Duration::from_secs(state.config.device_interval_seconds));

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
        }
    }
}
