use std::{
    net::IpAddr,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use anyhow::{anyhow, bail};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use tokio::{process::Command, time::timeout};
use tracing::{info, warn};

use crate::{config::CaptureConfig, db};

const EXECUTION_DISABLED_REASON: &str = "capture execution is not enabled";
const CAPTURE_RUNNER_TIMEOUT_GRACE_SECONDS: u64 = 5;
const CAPTURE_STDERR_LIMIT_CHARS: usize = 400;
const STALE_RUNNING_CAPTURE_BUFFER_SECONDS: u64 = 60;
const STALE_RUNNING_CAPTURE_REASON: &str = "capture request was recovered after becoming stale";

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CaptureRunnerStatus {
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureRunnerResult {
    pub status: CaptureRunnerStatus,
    pub failure_reason: Option<String>,
    pub file_size_bytes: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureExecutionPreflight {
    pub tcpdump_available: bool,
    pub output_dir_ready: bool,
    pub duration_bounds_valid: bool,
    pub allowed_interfaces_valid: bool,
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

pub async fn run_capture_command(
    command: &CaptureCommand,
    config: &CaptureConfig,
) -> anyhow::Result<CaptureRunnerResult> {
    if !config.execution_enabled {
        return Ok(CaptureRunnerResult {
            status: CaptureRunnerStatus::Failed,
            failure_reason: Some("capture execution is not enabled".to_string()),
            file_size_bytes: None,
        });
    }

    if command.program != "tcpdump" {
        return Ok(CaptureRunnerResult {
            status: CaptureRunnerStatus::Failed,
            failure_reason: Some("capture runner rejected unsupported command".to_string()),
            file_size_bytes: None,
        });
    }

    let timeout_duration = Duration::from_secs(
        command
            .duration_seconds
            .saturating_add(CAPTURE_RUNNER_TIMEOUT_GRACE_SECONDS),
    );

    let output = match timeout(
        timeout_duration,
        Command::new(&command.program).args(&command.args).output(),
    )
    .await
    {
        Ok(result) => result?,
        Err(_) => {
            return Ok(CaptureRunnerResult {
                status: CaptureRunnerStatus::Failed,
                failure_reason: Some("capture command timed out".to_string()),
                file_size_bytes: None,
            });
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr = truncate_for_operator(stderr.trim(), CAPTURE_STDERR_LIMIT_CHARS);

        let failure_reason = if stderr.is_empty() {
            format!("capture command failed with status {}", output.status)
        } else {
            format!("capture command failed: {stderr}")
        };

        return Ok(CaptureRunnerResult {
            status: CaptureRunnerStatus::Failed,
            failure_reason: Some(failure_reason),
            file_size_bytes: None,
        });
    }

    let file_size_bytes = match tokio::fs::metadata(&command.output_reference).await {
        Ok(metadata) => i64::try_from(metadata.len()).ok(),
        Err(_) => None,
    };

    Ok(CaptureRunnerResult {
        status: CaptureRunnerStatus::Completed,
        failure_reason: None,
        file_size_bytes,
    })
}

fn truncate_for_operator(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }

    let mut output = value.chars().take(max_chars).collect::<String>();
    output.push('…');
    output
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
    match recover_stale_running_capture_export_requests(pool, config, Utc::now()).await {
        Ok(recovered_count) => {
            if recovered_count > 0 {
                warn!(
                    recovered_count,
                    "stale running capture export requests recovered"
                );
            }
        }
        Err(err) => {
            warn!(
                error = %err,
                "stale running capture recovery failed"
            );
        }
    }

    let Some(request) = db::get_next_queued_capture_export_request(pool).await? else {
        if let Err(err) = cleanup_expired_capture_files(config).await {
            warn!(
                error = %err,
                "capture retention cleanup failed"
            );
        }

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

    let preflight = run_capture_execution_preflight(config).await?;

    if !preflight.duration_bounds_valid {
        db::fail_capture_export_request(
            pool,
            running_request.id,
            Utc::now(),
            "capture duration configuration is invalid",
        )
        .await?;

        warn!(
            request_id = running_request.id,
            "capture execution preflight failed: invalid duration bounds"
        );

        return Ok(true);
    }

    if !preflight.allowed_interfaces_valid {
        db::fail_capture_export_request(
            pool,
            running_request.id,
            Utc::now(),
            "capture allowed interface configuration is invalid",
        )
        .await?;

        warn!(
            request_id = running_request.id,
            "capture execution preflight failed: invalid allowed interface configuration"
        );

        return Ok(true);
    }

    if !preflight.output_dir_ready {
        db::fail_capture_export_request(
            pool,
            running_request.id,
            Utc::now(),
            "capture output directory is not ready",
        )
        .await?;

        warn!(
            request_id = running_request.id,
            "capture execution preflight failed: output directory is not ready"
        );

        return Ok(true);
    }

    if !preflight.tcpdump_available {
        db::fail_capture_export_request(
            pool,
            running_request.id,
            Utc::now(),
            "tcpdump is not available",
        )
        .await?;

        warn!(
            request_id = running_request.id,
            "capture execution preflight failed: tcpdump is not available"
        );

        return Ok(true);
    }

    match cleanup_expired_capture_files(config).await {
        Ok(removed_count) => {
            if removed_count > 0 {
                info!(
                    removed_count,
                    retention_hours = config.retention_hours,
                    "expired capture files removed"
                );
            }
        }
        Err(err) => {
            warn!(
                error = %err,
                "capture retention cleanup failed"
            );
        }
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
            let output_dir = match prepare_capture_output_dir(config).await {
                Ok(path) => path,
                Err(err) => {
                    db::fail_capture_export_request(
                        pool,
                        running_request.id,
                        Utc::now(),
                        &err.to_string(),
                    )
                    .await?;

                    warn!(
                        request_id = running_request.id,
                        error = %err,
                        "capture output directory preparation failed"
                    );

                    return Ok(true);
                }
            };

            db::attach_capture_export_request_command_metadata(
                pool,
                running_request.id,
                i64::try_from(command.duration_seconds)
                    .map_err(|_| anyhow::anyhow!("capture duration is too large"))?,
                &command.output_filename,
                &command.output_reference,
            )
            .await?;

            let runner_result = run_capture_command(&command, config).await?;

            match runner_result.status {
                CaptureRunnerStatus::Completed => {
                    db::complete_capture_export_request(
                        pool,
                        running_request.id,
                        Utc::now(),
                        runner_result.file_size_bytes,
                    )
                    .await?;

                    info!(
                        request_id = running_request.id,
                        output_dir = %output_dir.display(),
                        output_filename = %command.output_filename,
                        output_reference = %command.output_reference,
                        duration_seconds = command.duration_seconds,
                        "capture command completed through runner abstraction"
                    );
                }
                CaptureRunnerStatus::Failed => {
                    let failure_reason = runner_result
                        .failure_reason
                        .as_deref()
                        .unwrap_or("capture execution failed");

                    db::fail_capture_export_request(
                        pool,
                        running_request.id,
                        Utc::now(),
                        failure_reason,
                    )
                    .await?;

                    warn!(
                        request_id = running_request.id,
                        program = %command.program,
                        args = ?command.args,
                        output_dir = %output_dir.display(),
                        output_filename = %command.output_filename,
                        output_reference = %command.output_reference,
                        duration_seconds = command.duration_seconds,
                        failure_reason,
                        "capture runner returned failure"
                    );
                }
            }
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

pub async fn recover_stale_running_capture_export_requests(
    pool: &SqlitePool,
    config: &CaptureConfig,
    now: DateTime<Utc>,
) -> anyhow::Result<u64> {
    let stale_after_seconds = config
        .max_duration_seconds
        .saturating_add(STALE_RUNNING_CAPTURE_BUFFER_SECONDS);

    let cutoff_started_at =
        now - chrono::Duration::seconds(i64::try_from(stale_after_seconds).unwrap_or(i64::MAX));

    db::fail_stale_running_capture_export_requests(
        pool,
        cutoff_started_at,
        now,
        STALE_RUNNING_CAPTURE_REASON,
    )
    .await
}

pub async fn prepare_capture_output_dir(config: &CaptureConfig) -> anyhow::Result<PathBuf> {
    let output_dir = config.output_dir.trim();

    if output_dir.is_empty() {
        bail!("capture output directory is required");
    }

    let path = Path::new(output_dir);

    if path.exists() && !path.is_dir() {
        bail!("capture output path exists but is not a directory");
    }

    tokio::fs::create_dir_all(path).await?;

    Ok(path.to_path_buf())
}

fn is_lag_rat_capture_file(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    file_name.starts_with("capture-") && file_name.ends_with(".pcap")
}

pub async fn cleanup_expired_capture_files(config: &CaptureConfig) -> anyhow::Result<u64> {
    if config.retention_hours == 0 {
        return Ok(0);
    }

    let output_dir = prepare_capture_output_dir(config).await?;
    let retention = Duration::from_secs(config.retention_hours.saturating_mul(60 * 60));
    let now = SystemTime::now();

    let mut removed_count = 0;
    let mut entries = tokio::fs::read_dir(&output_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        if !path.is_file() || !is_lag_rat_capture_file(&path) {
            continue;
        }

        let metadata = entry.metadata().await?;
        let Ok(modified_at) = metadata.modified() else {
            continue;
        };

        let Ok(age) = now.duration_since(modified_at) else {
            continue;
        };

        if age <= retention {
            continue;
        }

        tokio::fs::remove_file(&path).await?;
        removed_count += 1;
    }

    Ok(removed_count)
}

pub async fn run_capture_execution_preflight(
    config: &CaptureConfig,
) -> anyhow::Result<CaptureExecutionPreflight> {
    let tcpdump_available = is_tcpdump_available().await;

    let output_dir_ready = prepare_capture_output_dir(config).await.is_ok();

    let duration_bounds_valid = config.min_duration_seconds > 0
        && config.max_duration_seconds >= config.min_duration_seconds
        && config.default_duration_seconds >= config.min_duration_seconds
        && config.default_duration_seconds <= config.max_duration_seconds;

    let allowed_interfaces_valid = config
        .allowed_interfaces
        .iter()
        .all(|interface_name| validate_capture_interface(config, interface_name).is_ok());

    Ok(CaptureExecutionPreflight {
        tcpdump_available,
        output_dir_ready,
        duration_bounds_valid,
        allowed_interfaces_valid,
    })
}

pub async fn delete_capture_file_for_request(
    config: &CaptureConfig,
    request: &crate::models::CaptureExportRequest,
) -> anyhow::Result<bool> {
    let Some(capture_reference) = request.capture_reference.as_deref() else {
        return Ok(false);
    };

    let output_dir = prepare_capture_output_dir(config).await?;
    let candidate = Path::new(capture_reference);

    let path = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        Path::new(capture_reference).to_path_buf()
    };

    if !is_lag_rat_capture_file(&path) {
        bail!("capture reference is not a Lag Rat capture file");
    }

    let allowed_root = output_dir.canonicalize()?;

    let candidate_parent = path.parent().unwrap_or_else(|| Path::new("."));

    let canonical_parent = if candidate_parent.exists() {
        candidate_parent.canonicalize()?
    } else {
        allowed_root.clone()
    };

    if canonical_parent != allowed_root {
        bail!("capture reference is outside the capture output directory");
    }

    if !path.exists() {
        return Ok(false);
    }

    if !path.is_file() {
        bail!("capture reference is not a file");
    }

    tokio::fs::remove_file(path).await?;

    Ok(true)
}

async fn is_tcpdump_available() -> bool {
    Command::new("tcpdump")
        .arg("--version")
        .output()
        .await
        .map(|output| output.status.success())
        .unwrap_or(false)
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

    #[tokio::test]
    async fn prepares_capture_output_directory() {
        let mut config = test_config();
        let temp_dir = std::env::temp_dir().join(format!(
            "lag-rat-capture-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        config.output_dir = temp_dir.to_string_lossy().to_string();

        let prepared = prepare_capture_output_dir(&config).await.unwrap();

        assert!(prepared.exists());
        assert!(prepared.is_dir());

        tokio::fs::remove_dir_all(prepared).await.unwrap();
    }

    #[tokio::test]
    async fn rejects_empty_capture_output_directory() {
        let mut config = test_config();
        config.output_dir = "   ".to_string();

        let err = prepare_capture_output_dir(&config).await.unwrap_err();

        assert_eq!(err.to_string(), "capture output directory is required");
    }

    #[tokio::test]
    async fn rejects_capture_output_path_that_is_file() {
        let mut config = test_config();
        let temp_file = std::env::temp_dir().join(format!(
            "lag-rat-capture-file-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        tokio::fs::write(&temp_file, b"not a directory")
            .await
            .unwrap();

        config.output_dir = temp_file.to_string_lossy().to_string();

        let err = prepare_capture_output_dir(&config).await.unwrap_err();

        assert_eq!(
            err.to_string(),
            "capture output path exists but is not a directory"
        );

        tokio::fs::remove_file(temp_file).await.unwrap();
    }

    #[tokio::test]
    async fn cleanup_removes_expired_capture_files_only() {
        let mut config = test_config();

        let temp_dir = std::env::temp_dir().join(format!(
            "lag-rat-capture-cleanup-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        tokio::fs::create_dir_all(&temp_dir).await.unwrap();

        let expired_capture = temp_dir.join("capture-1-20260429T123000Z.pcap");
        let fresh_capture = temp_dir.join("capture-2-20260429T123000Z.pcap");
        let unrelated_file = temp_dir.join("notes.txt");

        tokio::fs::write(&expired_capture, b"old capture")
            .await
            .unwrap();
        tokio::fs::write(&fresh_capture, b"fresh capture")
            .await
            .unwrap();
        tokio::fs::write(&unrelated_file, b"do not delete")
            .await
            .unwrap();

        filetime::set_file_mtime(
            &expired_capture,
            filetime::FileTime::from_system_time(
                SystemTime::now() - Duration::from_secs(48 * 60 * 60),
            ),
        )
        .unwrap();

        config.output_dir = temp_dir.to_string_lossy().to_string();
        config.retention_hours = 24;

        let removed_count = cleanup_expired_capture_files(&config).await.unwrap();

        assert_eq!(removed_count, 1);
        assert!(!expired_capture.exists());
        assert!(fresh_capture.exists());
        assert!(unrelated_file.exists());

        tokio::fs::remove_dir_all(temp_dir).await.unwrap();
    }

    #[tokio::test]
    async fn cleanup_skips_when_retention_is_zero() {
        let mut config = test_config();

        let temp_dir = std::env::temp_dir().join(format!(
            "lag-rat-capture-cleanup-disabled-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        tokio::fs::create_dir_all(&temp_dir).await.unwrap();

        let expired_capture = temp_dir.join("capture-1-20260429T123000Z.pcap");

        tokio::fs::write(&expired_capture, b"old capture")
            .await
            .unwrap();

        filetime::set_file_mtime(
            &expired_capture,
            filetime::FileTime::from_system_time(
                SystemTime::now() - Duration::from_secs(48 * 60 * 60),
            ),
        )
        .unwrap();

        config.output_dir = temp_dir.to_string_lossy().to_string();
        config.retention_hours = 0;

        let removed_count = cleanup_expired_capture_files(&config).await.unwrap();

        assert_eq!(removed_count, 0);
        assert!(expired_capture.exists());

        tokio::fs::remove_dir_all(temp_dir).await.unwrap();
    }

    #[tokio::test]
    async fn preflight_reports_invalid_duration_bounds() {
        let mut config = test_config();

        config.min_duration_seconds = 120;
        config.default_duration_seconds = 30;
        config.max_duration_seconds = 60;

        let result = run_capture_execution_preflight(&config).await.unwrap();

        assert!(!result.duration_bounds_valid);
    }

    #[tokio::test]
    async fn preflight_reports_invalid_allowed_interface_config() {
        let mut config = test_config();

        config.allowed_interfaces = vec!["../eth0".to_string()];

        let result = run_capture_execution_preflight(&config).await.unwrap();

        assert!(!result.allowed_interfaces_valid);
    }

    #[tokio::test]
    async fn preflight_reports_output_dir_not_ready_for_file_path() {
        let mut config = test_config();

        let temp_file = std::env::temp_dir().join(format!(
            "lag-rat-capture-preflight-file-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        tokio::fs::write(&temp_file, b"not a directory")
            .await
            .unwrap();

        config.output_dir = temp_file.to_string_lossy().to_string();

        let result = run_capture_execution_preflight(&config).await.unwrap();

        assert!(!result.output_dir_ready);

        tokio::fs::remove_file(temp_file).await.unwrap();
    }

    #[tokio::test]
    async fn capture_runner_short_circuits_when_execution_is_disabled() {
        let now = DateTime::parse_from_rfc3339("2026-04-29T12:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let mut config = test_config();
        config.execution_enabled = false;

        let command = build_capture_command(
            &config,
            CaptureCommandRequest {
                request_id: 22,
                interface_name: "eth0".to_string(),
                host_filter: Some("192.168.1.20".to_string()),
                duration_seconds: Some(30),
                now,
            },
        )
        .unwrap();

        let result = run_capture_command(&command, &config).await.unwrap();

        assert_eq!(result.status, CaptureRunnerStatus::Failed);
        assert_eq!(
            result.failure_reason.as_deref(),
            Some("capture execution is not enabled")
        );
        assert_eq!(result.file_size_bytes, None);
    }

    #[test]
    fn truncate_for_operator_leaves_short_messages_unchanged() {
        assert_eq!(
            truncate_for_operator("permission denied", 100),
            "permission denied"
        );
    }

    #[test]
    fn truncate_for_operator_shortens_long_messages() {
        let message = "x".repeat(20);

        assert_eq!(truncate_for_operator(&message, 5), "xxxxx…");
    }
}
