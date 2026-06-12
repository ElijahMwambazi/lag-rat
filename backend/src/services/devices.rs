use std::process::Command;

use chrono::Utc;

use crate::{
    db,
    models::{EnrichedDevice, KnownDevice},
    state::AppState,
};

pub async fn list_enriched(state: &AppState) -> anyhow::Result<Vec<EnrichedDevice>> {
    let devices = db::list_devices(&state.db, 200).await?;
    let known_devices = db::list_known_devices(&state.db).await?;
    let local_ips = local_ipv4_addrs();
    let current_hostname = local_hostname();

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

            let router_ip = resolve_router_ip(&state.config.router_ip);
            let is_gateway = device.ip_address == router_ip;

            let matches_local_ip =
                !is_gateway && local_ips.iter().any(|ip| ip == &device.ip_address);

            let matches_local_hostname = !is_gateway
                && current_hostname
                    .as_deref()
                    .zip(device.hostname.as_deref())
                    .map(|(current, device_host)| current == device_host)
                    .unwrap_or(false);

            let is_this_device = matches_local_ip || matches_local_hostname;

            let label = known.as_ref().map(|k| k.label.clone());
            let notes = known.as_ref().and_then(|k| k.notes.clone());

            let display_name = if is_this_device && label.is_none() {
                "This Device".to_string()
            } else {
                label
                    .clone()
                    .or_else(|| device.hostname.clone())
                    .unwrap_or_else(|| device.ip_address.clone())
            };

            let confidence = if is_gateway || is_this_device {
                "high"
            } else if device.mac_address.is_some() {
                "high"
            } else if known.is_some() {
                "medium"
            } else if device.hostname.is_some() {
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
                is_this_device,
                is_known: known.is_some(),
                confidence,
            }
        })
        .collect())
}

pub fn filter_by_confidence(
    devices: Vec<EnrichedDevice>,
    include_low_confidence: bool,
) -> Vec<EnrichedDevice> {
    if include_low_confidence {
        return devices;
    }

    devices
        .into_iter()
        .filter(|device| device.confidence != "low")
        .collect()
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

fn resolve_router_ip(configured_router_ip: &str) -> String {
    if configured_router_ip.trim().eq_ignore_ascii_case("auto") {
        return default_gateway_ip().unwrap_or_else(|| configured_router_ip.to_string());
    }

    configured_router_ip.to_string()
}

fn default_gateway_ip() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("ip")
            .args(["route", "show", "default"])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            let mut parts = line.split_whitespace();

            while let Some(part) = parts.next() {
                if part == "via" {
                    return parts.next().map(ToOwned::to_owned);
                }
            }
        }

        None
    }

    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

fn local_hostname() -> Option<String> {
    std::env::var("HOSTNAME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            std::env::var("COMPUTERNAME")
                .ok()
                .filter(|s| !s.trim().is_empty())
        })
}

fn local_ipv4_addrs() -> Vec<String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;

        if let Ok(output) = Command::new("ip")
            .args(["-o", "-4", "addr", "show"])
            .output()
        {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    return text
                        .lines()
                        .filter_map(|line| {
                            let columns: Vec<&str> = line.split_whitespace().collect();
                            let inet_index = columns.iter().position(|part| *part == "inet")?;
                            let cidr = *columns.get(inet_index + 1)?;
                            let ip = cidr.split('/').next()?.to_string();

                            if ip.starts_with("127.") {
                                return None;
                            }

                            Some(ip)
                        })
                        .collect();
                }
            }
        }

        Vec::new()
    }

    #[cfg(not(target_os = "linux"))]
    {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn test_device(id: i64, confidence: &str) -> EnrichedDevice {
        EnrichedDevice {
            id,
            ip_address: format!("192.168.1.{id}"),
            mac_address: None,
            hostname: None,
            display_name: format!("Device {id}"),
            label: None,
            notes: None,
            first_seen: Some(Utc::now()),
            last_seen: Some(Utc::now()),
            is_recent: true,
            is_gateway: false,
            is_this_device: false,
            is_known: false,
            confidence: confidence.to_string(),
        }
    }

    #[test]
    fn hides_low_confidence_devices_by_default() {
        let devices = vec![
            test_device(10, "high"),
            test_device(11, "medium"),
            test_device(12, "low"),
        ];

        let filtered = filter_by_confidence(devices, false);

        assert_eq!(filtered.len(), 2);
        assert!(filtered.iter().any(|device| device.confidence == "high"));
        assert!(filtered.iter().any(|device| device.confidence == "medium"));
        assert!(!filtered.iter().any(|device| device.confidence == "low"));
    }

    #[test]
    fn includes_low_confidence_devices_when_requested() {
        let devices = vec![
            test_device(10, "high"),
            test_device(11, "medium"),
            test_device(12, "low"),
        ];

        let filtered = filter_by_confidence(devices, true);

        assert_eq!(filtered.len(), 3);
        assert!(filtered.iter().any(|device| device.confidence == "low"));
    }
}
