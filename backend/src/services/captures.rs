use chrono::Utc;
use sqlx::SqlitePool;
use tracing::{info, warn};

use crate::db;

const EXECUTION_DISABLED_REASON: &str = "capture execution is not enabled";

pub async fn process_next_capture_export_request(pool: &SqlitePool) -> anyhow::Result<bool> {
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

    Ok(true)
}
