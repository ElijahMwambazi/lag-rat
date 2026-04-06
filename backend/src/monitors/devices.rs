use chrono::Utc;
use tokio::{fs, process::Command, sync::Semaphore};

use std::{net::Ipv4Addr, sync::Arc, time::Duration};

use crate::{db, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    if state.config.active_discovery_enabled {
        active_discovery_pass(state).await;
    }

    let lines = collect_inventory_lines(&state.config.arp_table_path).await;
    for line in lines {
        if let Some((ip, mac, host)) = parse_inventory_line(&line) {
            db::upsert_device(&state.db, &ip, mac.as_deref(), host.as_deref(), Utc::now()).await?;
        }
    }

    Ok(())
}

async fn active_discovery_pass(state: &AppState) {
    let ips = expand_ipv4_cidr(&state.config.local_subnet_cidr);
    if ips.is_empty() {
        return;
    }

    let timeout_ms = state.config.active_discovery_timeout_ms;
    let concurrency_limit = Arc::new(Semaphore::new(8));
    let mut tasks = Vec::with_capacity(ips.len());

    for ip in ips {
        let permit_pool = Arc::clone(&concurrency_limit);
        let router_ip = state.config.router_ip.clone();

        tasks.push(tokio::spawn(async move {
            let _permit = permit_pool.acquire_owned().await.ok()?;
            if ip == router_ip {
                let _ = probe_host(&ip, timeout_ms).await;
                return Some(());
            }
            let _ = probe_host(&ip, timeout_ms).await;
            Some(())
        }));
    }

    for task in tasks {
        let _ = task.await;
    }
}

pub fn expand_ipv4_cidr(cidr: &str) -> Vec<String> {
    let (base_ip, prefix_len) = match parse_cidr(cidr) {
        Some(value) => value,
        None => return vec![],
    };

    if prefix_len > 30 {
        return vec![];
    }

    let host_bits = 32 - prefix_len;
    let total = 1u32.checked_shl(host_bits).unwrap_or(0);
    if total < 4 {
        return vec![];
    }

    let network = base_ip & (!0u32 << host_bits);
    let first_host = network + 1;
    let last_host = network + total - 2;

    (first_host..=last_host).map(u32_to_ipv4).collect()
}

fn parse_cidr(cidr: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return None;
    }

    let ip = ipv4_to_u32(parts[0])?;
    let prefix_len = parts[1].parse::<u32>().ok()?;
    if prefix_len > 32 {
        return None;
    }

    Some((ip, prefix_len))
}

async fn probe_host(ip: &str, timeout_ms: u64) -> bool {
    for port in [80_u16, 443, 22, 53] {
        let addr = format!("{ip}:{port}");
        let result = tokio::time::timeout(
            Duration::from_millis(timeout_ms),
            tokio::net::TcpStream::connect(&addr),
        )
        .await;

        if matches!(result, Ok(Ok(_))) {
            return true;
        }
    }
    false
}

async fn collect_inventory_lines(arp_table_path: &str) -> Vec<String> {
    let mut lines = Vec::new();

    #[cfg(target_os = "linux")]
    {
        if let Ok(contents) = fs::read_to_string(arp_table_path).await {
            lines.extend(contents.lines().skip(1).map(str::to_string));
        }

        if let Ok(output) = Command::new("ip").args(["neigh", "show"]).output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    lines.extend(text.lines().map(str::to_string));
                }
            }
        }

        if let Ok(output) = Command::new("arp").arg("-an").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    lines.extend(text.lines().map(str::to_string));
                }
            }
        }
    }

    #[cfg(any(
        target_os = "macos",
        target_os = "freebsd",
        target_os = "openbsd",
        target_os = "netbsd"
    ))]
    {
        if let Ok(output) = Command::new("arp").arg("-an").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    lines.extend(text.lines().map(str::to_string));
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("arp").arg("-a").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    lines.extend(text.lines().map(str::to_string));
                }
            }
        }
    }

    lines
}

pub fn parse_inventory_line(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    parse_linux_ip_neigh(line)
        .or_else(|| parse_linux_proc_arp(line))
        .or_else(|| parse_unix_arp(line))
        .or_else(|| parse_windows_arp(line))
}

pub fn parse_linux_proc_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 6 {
        return None;
    }

    let ip = columns[0];
    if !looks_like_ipv4(ip) {
        return None;
    }

    // /proc/net/arp shape:
    // IP address | HW type | Flags | HW address | Mask | Device
    if !columns[1].starts_with("0x") || !columns[2].starts_with("0x") {
        return None;
    }

    let mac = normalize_mac(columns[3]);
    let hostname = normalize_host(columns[5]);

    Some((ip.to_string(), mac, hostname))
}

pub fn parse_linux_ip_neigh(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 3 {
        return None;
    }

    let ip = columns[0];
    if !looks_like_ipv4(ip) {
        return None;
    }

    let dev_index = columns.iter().position(|part| *part == "dev");
    let lladdr_index = columns.iter().position(|part| *part == "lladdr");

    let host = dev_index
        .and_then(|idx| columns.get(idx + 1))
        .and_then(|value| normalize_host(value));

    let mac = lladdr_index
        .and_then(|idx| columns.get(idx + 1))
        .and_then(|value| normalize_mac(value));

    Some((ip.to_string(), mac, host))
}

pub fn parse_unix_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    let line = line.trim();
    let open = line.find('(')?;
    let close = line[open + 1..].find(')')? + open + 1;
    let ip = line[open + 1..close].trim();

    if !looks_like_ipv4(ip) {
        return None;
    }

    let host = line[..open].trim();
    let hostname = normalize_host(host);

    let lower = line.to_ascii_lowercase();
    let at_idx = lower.find(" at ")?;
    let after_at = &line[at_idx + 4..];
    let mac = after_at.split_whitespace().next().and_then(normalize_mac);

    Some((ip.to_string(), mac, hostname))
}

pub fn parse_windows_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 2 {
        return None;
    }

    let ip = columns[0];
    if !looks_like_ipv4(ip) {
        return None;
    }

    let mac = normalize_mac(columns[1]);
    Some((ip.to_string(), mac, None))
}

fn normalize_mac(value: &str) -> Option<String> {
    let value = value.trim().trim_matches(',');
    if value.is_empty()
        || value == "*"
        || value == "incomplete"
        || value == "<incomplete>"
        || value == "(incomplete)"
        || value == "00:00:00:00:00:00"
    {
        None
    } else {
        Some(value.replace('-', ":").to_ascii_lowercase())
    }
}

fn normalize_host(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value == "?" || value == "on" {
        return None;
    }

    let lower = value.to_ascii_lowercase();

    let blocked_exact = [
        "lladdr",
        "reachable",
        "stale",
        "delay",
        "failed",
        "incomplete",
        "probe",
        "router",
        "permanent",
        "dev",
    ];

    if blocked_exact.contains(&lower.as_str()) {
        return None;
    }

    if lower.starts_with("wl")
        || lower.starts_with("wlan")
        || lower.starts_with("eth")
        || lower.starts_with("enp")
        || lower.starts_with("eno")
        || lower.starts_with("ens")
        || lower.starts_with("lo")
        || lower.starts_with("br-")
        || lower.starts_with("docker")
        || lower.starts_with("tun")
        || lower.starts_with("tap")
        || lower.starts_with("veth")
    {
        return None;
    }

    Some(value.to_string())
}

fn looks_like_ipv4(value: &str) -> bool {
    value.parse::<Ipv4Addr>().is_ok()
}

fn ipv4_to_u32(ip: &str) -> Option<u32> {
    let addr: Ipv4Addr = ip.parse().ok()?;
    Some(u32::from(addr))
}

fn u32_to_ipv4(num: u32) -> String {
    Ipv4Addr::from(num).to_string()
}
