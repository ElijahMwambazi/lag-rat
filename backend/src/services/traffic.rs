use anyhow::Result;
use chrono::Utc;

use crate::models::{CollectorObservation, TrafficObservation};

pub async fn collect_interface_traffic_snapshots() -> Result<Vec<CollectorObservation>> {
    let contents = tokio::fs::read_to_string("/proc/net/dev").await?;
    let observed_at = Utc::now();

    let mut items = Vec::new();

    for line in contents.lines().skip(2) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.split(':');
        let interface_name = match parts.next() {
            Some(value) => value.trim(),
            None => continue,
        };

        let counters = match parts.next() {
            Some(value) => value.split_whitespace().collect::<Vec<_>>(),
            None => continue,
        };

        if counters.len() < 10 {
            continue;
        }

        let bytes_rx = counters[0].parse::<i64>().unwrap_or(0);
        let packets_rx = counters[1].parse::<i64>().ok();
        let bytes_tx = counters[8].parse::<i64>().unwrap_or(0);
        let packets_tx = counters[9].parse::<i64>().ok();

        items.push(CollectorObservation::Traffic(TrafficObservation {
            module: "home_network".to_string(),
            collector_type: "traffic_interface_counters".to_string(),
            interface_name: interface_name.to_string(),
            entity_type: "interface".to_string(),
            entity_key: interface_name.to_string(),
            device_ip_address: None,
            mac_address: None,
            bytes_rx,
            bytes_tx,
            packets_rx,
            packets_tx,
            observed_at,
        }));
    }

    Ok(items)
}
