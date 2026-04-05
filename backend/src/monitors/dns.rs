use std::time::{Duration, Instant};

use chrono::Utc;
use tokio::{net::lookup_host, time::timeout};

use crate::{db, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let start = Instant::now();
    let target = format!("{}:80", state.config.dns_test_domain);

    let result = timeout(
        Duration::from_millis(state.config.request_timeout_ms),
        lookup_host(target),
    )
    .await;

    match result {
        Ok(Ok(mut addrs)) => {
            let success = addrs.next().is_some();
            db::insert_dns_check(
                &state.db,
                Utc::now(),
                &state.config.dns_test_domain,
                &state.config.dns_resolver,
                success,
                Some(start.elapsed().as_secs_f64() * 1000.0),
                if success { None } else { Some("no addresses returned") },
            )
            .await?;
        }
        Ok(Err(err)) => {
            db::insert_dns_check(
                &state.db,
                Utc::now(),
                &state.config.dns_test_domain,
                &state.config.dns_resolver,
                false,
                None,
                Some(&err.to_string()),
            )
            .await?;
        }
        Err(_) => {
            db::insert_dns_check(
                &state.db,
                Utc::now(),
                &state.config.dns_test_domain,
                &state.config.dns_resolver,
                false,
                None,
                Some("dns probe timed out"),
            )
            .await?;
        }
    }

    Ok(())
}
