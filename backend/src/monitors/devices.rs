use chrono::Utc;
use tokio::{fs, process::Command, sync::Semaphore};

use std::{collections::HashSet, net::Ipv4Addr, sync::Arc, time::Duration};

use crate::{
    db,
    models::{CollectorObservation, DeviceObservation},
    services::collector_ingest,
    state::AppState,
};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    register_local_host(state).await?;

    let reachable_ips = if state.config.active_discovery_enabled {
        active_discovery_pass(state).await
    } else {
        HashSet::new()
    };

    let lines = collect_inventory_lines(&state.config.arp_table_path).await;

    let confirmed_neighbor_ips: HashSet<String> = lines
        .iter()
        .filter_map(|line| parse_linux_ip_neigh_with_state(line))
        .filter(|(_, _, _, state)| is_confirmed_neighbor_state(state))
        .map(|(ip, _, _, _)| ip)
        .collect();

    for line in lines {
        if let Some((ip, mac, host)) = parse_inventory_line(&line) {
            let is_confirmed = reachable_ips.contains(&ip) || confirmed_neighbor_ips.contains(&ip);

            if !should_persist_device_entry(
                &ip,
                mac.as_deref(),
                host.as_deref(),
                &state.config.router_ip,
                is_confirmed,
            ) {
                continue;
            }

            let resolved_host = match host {
                Some(existing_host) => Some(existing_host),
                None => resolve_hostname_for_ip(&ip).await,
            };

            collector_ingest::ingest(
                state,
                CollectorObservation::Device(DeviceObservation {
                    module: "home_network".to_string(),
                    collector_type: "device_inventory".to_string(),
                    ip_address: ip.clone(),
                    mac_address: mac.clone(),
                    hostname: resolved_host.clone(),
                    entity_type: "device".to_string(),
                    entity_key: ip.clone(),
                    observed_at: Utc::now(),
                }),
            )
            .await?;
        }
    }

    db::prune_stale_devices(&state.db, 24 * 14).await?;

    Ok(())
}

async fn active_discovery_pass(state: &AppState) -> HashSet<String> {
    let ips = expand_ipv4_cidr(&state.config.local_subnet_cidr);
    if ips.is_empty() {
        return HashSet::new();
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
                return Some((ip, true));
            }

            let reachable = probe_host(&ip, timeout_ms).await;
            Some((ip, reachable))
        }));
    }

    let mut reachable_ips = HashSet::new();

    for task in tasks {
        if let Ok(Some((ip, true))) = task.await {
            reachable_ips.insert(ip);
        }
    }

    reachable_ips
}

async fn register_local_host(state: &AppState) -> anyhow::Result<()> {
    let hostname = local_hostname();
    let now = Utc::now();

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("ip")
            .args(["-o", "-4", "addr", "show"])
            .output()
            .await
        {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for line in text.lines() {
                        if let Some((ip, iface)) = parse_linux_ip_addr_line(line) {
                            if ip == state.config.router_ip {
                                continue;
                            }

                            if !ip_is_in_cidr(&ip, &state.config.local_subnet_cidr) {
                                continue;
                            }

                            let host = hostname.clone().or_else(|| normalize_host(&iface));
                            let mac = linux_mac_for_interface(&iface).await;

                            collector_ingest::ingest(
                                state,
                                CollectorObservation::Device(DeviceObservation {
                                    module: "home_network".to_string(),
                                    collector_type: "local_host_registration".to_string(),
                                    ip_address: ip.clone(),
                                    mac_address: mac.clone(),
                                    hostname: host.clone(),
                                    entity_type: "device".to_string(),
                                    entity_key: ip.clone(),
                                    observed_at: now,
                                }),
                            )
                            .await?;
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("ifconfig").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for ip in parse_macos_ipv4_addrs(&text) {
                        if ip == state.config.router_ip {
                            continue;
                        }

                        if !ip_is_in_cidr(&ip, &state.config.local_subnet_cidr) {
                            continue;
                        }

                        collector_ingest::ingest(
                            state,
                            CollectorObservation::Device(DeviceObservation {
                                module: "home_network".to_string(),
                                collector_type: "local_host_registration".to_string(),
                                ip_address: ip.clone(),
                                mac_address: None,
                                hostname: hostname.clone(),
                                entity_type: "device".to_string(),
                                entity_key: ip.clone(),
                                observed_at: now,
                            }),
                        )
                        .await?;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("ipconfig").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for ip in parse_windows_ipv4_addrs(&text) {
                        if ip == state.config.router_ip {
                            continue;
                        }

                        if !ip_is_in_cidr(&ip, &state.config.local_subnet_cidr) {
                            continue;
                        }

                        collector_ingest::ingest(
                            state,
                            CollectorObservation::Device(DeviceObservation {
                                module: "home_network".to_string(),
                                collector_type: "local_host_registration".to_string(),
                                ip_address: ip.clone(),
                                mac_address: None,
                                hostname: hostname.clone(),
                                entity_type: "device".to_string(),
                                entity_key: ip.clone(),
                                observed_at: now,
                            }),
                        )
                        .await?;
                    }
                }
            }
        }
    }

    Ok(())
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

pub fn parse_getent_hosts_output(text: &str) -> Option<String> {
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }

    let columns: Vec<&str> = line.split_whitespace().collect();
    let hostname = columns.get(1)?;
    normalize_host(hostname)
}

pub fn parse_avahi_resolve_output(text: &str) -> Option<String> {
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }

    let hostname = line.split_whitespace().nth(1)?;
    normalize_host(hostname)
}

fn parse_linux_ip_addr_line(line: &str) -> Option<(String, String)> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 4 {
        return None;
    }

    let iface = columns.get(1)?.trim_end_matches(':').to_string();
    let inet_index = columns.iter().position(|part| *part == "inet")?;
    let cidr = *columns.get(inet_index + 1)?;
    let ip = cidr.split('/').next()?.to_string();

    if !looks_like_ipv4(&ip) || ip.starts_with("127.") {
        return None;
    }

    Some((ip, iface))
}

#[cfg(target_os = "linux")]
async fn linux_mac_for_interface(iface: &str) -> Option<String> {
    if let Some(mac) = linux_mac_from_ip_link(iface).await {
        return Some(mac);
    }

    linux_mac_from_sysfs(iface).await
}

#[cfg(target_os = "linux")]
async fn linux_mac_from_ip_link(iface: &str) -> Option<String> {
    let output = Command::new("ip")
        .args(["link", "show", "dev", iface])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8(output.stdout).ok()?;

    for line in text.lines() {
        let columns: Vec<&str> = line.split_whitespace().collect();
        if let Some(link_index) = columns.iter().position(|part| *part == "link/ether") {
            if let Some(mac) = columns.get(link_index + 1) {
                return normalize_mac(mac);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
async fn linux_mac_from_sysfs(iface: &str) -> Option<String> {
    let path = format!("/sys/class/net/{iface}/address");
    let text = fs::read_to_string(path).await.ok()?;
    normalize_mac(text.trim())
}

#[cfg(target_os = "macos")]
fn parse_macos_ipv4_addrs(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with("inet ") {
                return None;
            }

            let ip = trimmed.split_whitespace().nth(1)?.to_string();
            if ip.starts_with("127.") || !looks_like_ipv4(&ip) {
                return None;
            }

            Some(ip)
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn parse_windows_ipv4_addrs(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| {
            let lower = line.to_ascii_lowercase();
            if !lower.contains("ipv4") {
                return None;
            }

            let ip = line.split(':').nth(1)?.trim().to_string();
            if ip.starts_with("127.") || !looks_like_ipv4(&ip) {
                return None;
            }

            Some(ip)
        })
        .collect()
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

async fn resolve_hostname_for_ip(ip: &str) -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(host) = hostname_from_getent(ip).await {
            return Some(host);
        }

        if let Some(host) = hostname_from_avahi(ip).await {
            return Some(host);
        }
    }

    None
}

#[cfg(target_os = "linux")]
async fn hostname_from_getent(ip: &str) -> Option<String> {
    let output = Command::new("getent")
        .args(["hosts", ip])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8(output.stdout).ok()?;
    parse_getent_hosts_output(&text)
}

#[cfg(target_os = "linux")]
async fn hostname_from_avahi(ip: &str) -> Option<String> {
    let output = Command::new("avahi-resolve-address")
        .arg(ip)
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8(output.stdout).ok()?;
    parse_avahi_resolve_output(&text)
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

    if !columns[1].starts_with("0x") || !columns[2].starts_with("0x") {
        return None;
    }

    let mac = normalize_mac(columns[3]);
    let hostname = normalize_host(columns[5]);

    Some((ip.to_string(), mac, hostname))
}

pub fn parse_linux_ip_neigh(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    parse_linux_ip_neigh_with_state(line).map(|(ip, mac, host, _)| (ip, mac, host))
}

pub fn parse_linux_ip_neigh_with_state(
    line: &str,
) -> Option<(String, Option<String>, Option<String>, String)> {
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

    let state = columns.last()?.to_string();

    Some((ip.to_string(), mac, host, state))
}

pub fn is_confirmed_neighbor_state(state: &str) -> bool {
    matches!(
        state,
        "REACHABLE" | "STALE" | "DELAY" | "PROBE" | "PERMANENT"
    )
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

pub fn should_persist_device_entry(
    ip: &str,
    mac: Option<&str>,
    host: Option<&str>,
    router_ip: &str,
    is_reachable: bool,
) -> bool {
    if ip == router_ip {
        return true;
    }

    if mac.is_some() {
        return true;
    }

    if let Some(host) = host {
        let trimmed = host.trim();
        if !trimmed.is_empty() && trimmed != ip {
            return true;
        }
    }

    is_reachable
}

pub fn ip_is_in_cidr(ip: &str, cidr: &str) -> bool {
    let ip_num = match ipv4_to_u32(ip) {
        Some(value) => value,
        None => return false,
    };

    let (base_ip, prefix_len) = match parse_cidr(cidr) {
        Some(value) => value,
        None => return false,
    };

    let mask = if prefix_len == 0 {
        0
    } else {
        !0u32 << (32 - prefix_len)
    };

    (ip_num & mask) == (base_ip & mask)
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
    let value = value.trim().trim_start_matches('_');
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
