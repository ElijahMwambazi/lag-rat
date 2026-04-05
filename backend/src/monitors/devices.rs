use chrono::Utc;
use tokio::{fs, process::Command};

use crate::{db, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let lines = collect_inventory_lines(&state.config.arp_table_path).await;

    for line in lines {
        if let Some((ip, mac, host)) = parse_inventory_line(&line) {
            db::upsert_device(&state.db, &ip, mac.as_deref(), host.as_deref(), Utc::now()).await?;
        }
    }

    Ok(())
}

async fn collect_inventory_lines(arp_table_path: &str) -> Vec<String> {
    let mut lines = Vec::new();

    #[cfg(target_os = "linux")]
    {
        if let Ok(contents) = fs::read_to_string(arp_table_path).await {
            lines.extend(contents.lines().skip(1).map(str::to_string));
        }

        if let Ok(output) = Command::new("arp").arg("-an").output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    lines.extend(text.lines().map(str::to_string));
                }
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "freebsd", target_os = "openbsd", target_os = "netbsd"))]
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

fn parse_inventory_line(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    parse_linux_proc_arp(line)
        .or_else(|| parse_unix_arp(line))
        .or_else(|| parse_windows_arp(line))
}

fn parse_linux_proc_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 6 {
        return None;
    }

    let ip = columns[0];
    let mac = normalize_mac(columns[3]);
    let hostname = normalize_host(columns[5]);

    if !looks_like_ipv4(ip) {
        return None;
    }

    Some((ip.to_string(), mac, hostname))
}

fn parse_unix_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
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

fn parse_windows_arp(line: &str) -> Option<(String, Option<String>, Option<String>)> {
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
        None
    } else {
        Some(value.to_string())
    }
}

fn looks_like_ipv4(value: &str) -> bool {
    let parts: Vec<&str> = value.split('.').collect();
    if parts.len() != 4 {
        return false;
    }

    parts.iter().all(|part| part.parse::<u8>().is_ok())
}
