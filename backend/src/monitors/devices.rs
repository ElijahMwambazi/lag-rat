use chrono::Utc;
use tokio::fs;

use crate::{db, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let arp_contents = match fs::read_to_string(&state.config.arp_table_path).await {
        Ok(contents) => contents,
        Err(_) => return Ok(()),
    };

    for line in arp_contents.lines().skip(1) {
        let columns: Vec<&str> = line.split_whitespace().collect();
        if columns.len() < 6 {
            continue;
        }

        let ip = columns[0];
        let mac = normalize(columns[3]);
        let device = columns[5];

        if ip == "IP" || mac.as_deref() == Some("00:00:00:00:00:00") {
            continue;
        }

        let hostname = if device.is_empty() { None } else { Some(device) };

        db::upsert_device(
            &state.db,
            ip,
            mac.as_deref(),
            hostname,
            Utc::now(),
        )
        .await?;
    }

    Ok(())
}

fn normalize(value: &str) -> Option<&str> {
    if value.is_empty() || value == "*" {
        None
    } else {
        Some(value)
    }
}
