use std::time::{Duration, Instant};

use chrono::Utc;
use tokio::{net::lookup_host, time::timeout};

use crate::{db, services::alerts, state::AppState};

pub async fn run(state: &AppState) -> anyhow::Result<()> {
    let start = Instant::now();
    let target = format!("{}:80", state.config.dns_test_domain);

    let result = timeout(Duration::from_millis(state.config.request_timeout_ms), lookup_host(target)).await;

    match result {
        Ok(Ok(mut addrs)) => {
            let success = addrs.next().is_some();
            let response_time = Some(start.elapsed().as_secs_f64() * 1000.0);
            let error = if success { None } else { Some("no addresses returned".to_string()) };
            db::insert_dns_check(&state.db, Utc::now(), &state.config.dns_test_domain, &state.config.dns_resolver, success, response_time, error.as_deref()).await?;
            alerts::evaluate_dns(state, &state.config.dns_test_domain, success, error.as_deref()).await?;
        }
        Ok(Err(err)) => {
            let msg = err.to_string();
            db::insert_dns_check(&state.db, Utc::now(), &state.config.dns_test_domain, &state.config.dns_resolver, false, None, Some(&msg)).await?;
            alerts::evaluate_dns(state, &state.config.dns_test_domain, false, Some(&msg)).await?;
        }
        Err(_) => {
            let msg = "dns probe timed out".to_string();
            db::insert_dns_check(&state.db, Utc::now(), &state.config.dns_test_domain, &state.config.dns_resolver, false, None, Some(&msg)).await?;
            alerts::evaluate_dns(state, &state.config.dns_test_domain, false, Some(&msg)).await?;
        }
    }
    Ok(())
}
