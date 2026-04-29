use std::net::IpAddr;

use anyhow::{anyhow, bail};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use tracing::{info, warn};

use crate::{config::CaptureConfig, db};

const EXECUTION_DISABLED_REASON: &str = "capture execution is not enabled";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureCommand {
    pub program: String,
    pub args: Vec<String>,
    pub output_filename: String,
    pub output_reference: String,
    pub duration_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct CaptureCommandRequest {
    pub request_id: i64,
    pub interface_name: String,
    pub host_filter: Option<String>,
    pub duration_seconds: Option<u64>,
    pub now: DateTime<Utc>,
}

pub fn build_capture_command(
    config: &CaptureConfig,
    request: CaptureCommandRequest,
) -> anyhow::Result<CaptureCommand> {
    let interface_name = request.interface_name.trim();

    if interface_name.is_empty() {
        bail!("capture interface is required");
    }

    validate_capture_interface(config, interface_name)?;

    let duration_seconds = normalize_capture_duration(config, request.duration_seconds)?;

    let output_filename = format!(
        "capture-{}-{}.pcap",
        request.request_id,
        request.now.format("%Y%m%dT%H%M%SZ")
    );

    let output_reference = format!(
        "{}/{}",
        config.output_dir.trim_end_matches('/'),
        output_filename
    );

    let mut args = vec!["-i".to_string(), interface_name.to_string()];

    if let Some(host_filter) = request.host_filter.as_deref() {
        let host_filter = host_filter.trim();

        if !host_filter.is_empty() {
            validate_capture_host_filter(host_filter)?;

            args.push("host".to_string());
            args.push(host_filter.to_string());
        }
    }

    args.extend([
        "-w".to_string(),
        output_reference.clone(),
        "-G".to_string(),
        duration_seconds.to_string(),
        "-W".to_string(),
        "1".to_string(),
    ]);

    Ok(CaptureCommand {
        program: "tcpdump".to_string(),
        args,
        output_filename,
        output_reference,
        duration_seconds,
    })
}

fn validate_capture_interface(config: &CaptureConfig, interface_name: &str) -> anyhow::Result<()> {
    if interface_name.contains('/') || interface_name.contains('\\') {
        bail!("capture interface must be a plain interface name");
    }

    if interface_name.contains(' ') || interface_name.contains('\t') {
        bail!("capture interface must not contain whitespace");
    }

    if !interface_name
        .chars()
        .all(|item| item.is_ascii_alphanumeric() || matches!(item, '_' | '-' | '.'))
    {
        bail!("capture interface contains unsupported characters");
    }

    if !config.allowed_interfaces.is_empty()
        && !config
            .allowed_interfaces
            .iter()
            .any(|allowed| allowed == interface_name)
    {
        bail!("capture interface is not allowed");
    }

    Ok(())
}

fn normalize_capture_duration(
    config: &CaptureConfig,
    requested_duration_seconds: Option<u64>,
) -> anyhow::Result<u64> {
    if config.min_duration_seconds == 0 {
        bail!("minimum capture duration must be greater than zero");
    }

    if config.max_duration_seconds < config.min_duration_seconds {
        bail!("maximum capture duration must be greater than or equal to minimum duration");
    }

    let duration = requested_duration_seconds.unwrap_or(config.default_duration_seconds);

    if duration < config.min_duration_seconds {
        bail!(
            "capture duration must be at least {} seconds",
            config.min_duration_seconds
        );
    }

    if duration > config.max_duration_seconds {
        bail!(
            "capture duration must be at most {} seconds",
            config.max_duration_seconds
        );
    }

    Ok(duration)
}

fn validate_capture_host_filter(host_filter: &str) -> anyhow::Result<()> {
    let parsed: IpAddr = host_filter
        .parse()
        .map_err(|_| anyhow!("capture host filter must be an IP address"))?;

    if parsed.is_unspecified() {
        bail!("capture host filter must not be unspecified");
    }

    if parsed.is_multicast() {
        bail!("capture host filter must not be multicast");
    }

    Ok(())
}

pub async fn process_next_capture_export_request(
    pool: &SqlitePool,
    config: &CaptureConfig,
) -> anyhow::Result<bool> {
    let Some(request) = db::get_next_queued_capture_export_request(pool).await? else {
        return Ok(false);
    };

    info!(
        request_id = request.id,
        source = %request.source,
        interface_name = ?request.interface_name,
        "capture worker picked queued export request"
    );

    let Some(running_request) =
        db::start_capture_export_request(pool, request.id, Utc::now()).await?
    else {
        warn!(
            request_id = request.id,
            "queued capture export request could not be started; status may have changed"
        );

        return Ok(false);
    };

    if !config.execution_enabled {
        db::fail_capture_export_request(
            pool,
            running_request.id,
            Utc::now(),
            EXECUTION_DISABLED_REASON,
        )
        .await?;

        warn!(
            request_id = running_request.id,
            reason = EXECUTION_DISABLED_REASON,
            "capture execution skipped"
        );

        return Ok(true);
    }

    let interface_name = running_request
        .interface_name
        .clone()
        .ok_or_else(|| anyhow!("capture export request is missing interface name"))?;

    let host_filter = running_request
        .device_ip_address
        .clone()
        .or_else(|| running_request.entity_key.clone());

    let command_result = build_capture_command(
        config,
        CaptureCommandRequest {
            request_id: running_request.id,
            interface_name,
            host_filter,
            duration_seconds: running_request
                .duration_seconds
                .and_then(|value| u64::try_from(value).ok()),
            now: Utc::now(),
        },
    );

    match command_result {
        Ok(command) => {
            db::attach_capture_export_request_command_metadata(
                pool,
                running_request.id,
                i64::try_from(command.duration_seconds)
                    .map_err(|_| anyhow::anyhow!("capture duration is too large"))?,
                &command.output_filename,
                &command.output_reference,
            )
            .await?;

            db::fail_capture_export_request(
                pool,
                running_request.id,
                Utc::now(),
                "capture command built but execution runner is not implemented",
            )
            .await?;

            warn!(
                request_id = running_request.id,
                program = %command.program,
                args = ?command.args,
                output_filename = %command.output_filename,
                output_reference = %command.output_reference,
                duration_seconds = command.duration_seconds,
                "capture command metadata persisted but not executed"
            );
        }
        Err(err) => {
            db::fail_capture_export_request(pool, running_request.id, Utc::now(), &err.to_string())
                .await?;

            warn!(
                request_id = running_request.id,
                error = %err,
                "capture command validation failed"
            );
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CaptureConfig;

    fn test_config() -> CaptureConfig {
        CaptureConfig {
            worker_interval_seconds: 10,
            execution_enabled: true,
            retention_hours: 24,
            max_file_mb: 50,
            default_duration_seconds: 30,
            min_duration_seconds: 5,
            max_duration_seconds: 120,
            output_dir: "data/captures".to_string(),
            allowed_interfaces: vec!["eth0".to_string(), "wlan0".to_string()],
        }
    }

    #[test]
    fn builds_default_capture_command() {
        let now = DateTime::parse_from_rfc3339("2026-04-29T12:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let command = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 12,
                interface_name: "eth0".to_string(),
                host_filter: None,
                duration_seconds: None,
                now,
            },
        )
        .unwrap();

        assert_eq!(command.program, "tcpdump");
        assert_eq!(command.output_filename, "capture-12-20260429T123000Z.pcap");
        assert_eq!(
            command.output_reference,
            "data/captures/capture-12-20260429T123000Z.pcap"
        );
        assert_eq!(command.duration_seconds, 30);
        assert_eq!(
            command.args,
            vec![
                "-i",
                "eth0",
                "-w",
                "data/captures/capture-12-20260429T123000Z.pcap",
                "-G",
                "30",
                "-W",
                "1",
            ]
        );
    }

    #[test]
    fn builds_host_scoped_capture_command() {
        let now = DateTime::parse_from_rfc3339("2026-04-29T12:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let command = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 13,
                interface_name: "wlan0".to_string(),
                host_filter: Some("192.168.1.20".to_string()),
                duration_seconds: Some(60),
                now,
            },
        )
        .unwrap();

        assert_eq!(
            command.args,
            vec![
                "-i",
                "wlan0",
                "host",
                "192.168.1.20",
                "-w",
                "data/captures/capture-13-20260429T123000Z.pcap",
                "-G",
                "60",
                "-W",
                "1",
            ]
        );
    }

    #[test]
    fn rejects_unallowed_interface() {
        let now = Utc::now();

        let err = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 14,
                interface_name: "any".to_string(),
                host_filter: None,
                duration_seconds: None,
                now,
            },
        )
        .unwrap_err();

        assert_eq!(err.to_string(), "capture interface is not allowed");
    }

    #[test]
    fn rejects_interface_with_path_separator() {
        let now = Utc::now();

        let err = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 15,
                interface_name: "../eth0".to_string(),
                host_filter: None,
                duration_seconds: None,
                now,
            },
        )
        .unwrap_err();

        assert_eq!(
            err.to_string(),
            "capture interface must be a plain interface name"
        );
    }

    #[test]
    fn rejects_duration_above_maximum() {
        let now = Utc::now();

        let err = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 16,
                interface_name: "eth0".to_string(),
                host_filter: None,
                duration_seconds: Some(121),
                now,
            },
        )
        .unwrap_err();

        assert_eq!(
            err.to_string(),
            "capture duration must be at most 120 seconds"
        );
    }

    #[test]
    fn rejects_invalid_host_filter() {
        let now = Utc::now();

        let err = build_capture_command(
            &test_config(),
            CaptureCommandRequest {
                request_id: 17,
                interface_name: "eth0".to_string(),
                host_filter: Some("192.168.1.20 or port 80".to_string()),
                duration_seconds: None,
                now,
            },
        )
        .unwrap_err();

        assert_eq!(err.to_string(), "capture host filter must be an IP address");
    }
}
