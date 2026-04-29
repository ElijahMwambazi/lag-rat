ALTER TABLE capture_export_requests ADD COLUMN queued_at TEXT;
ALTER TABLE capture_export_requests ADD COLUMN started_at TEXT;
ALTER TABLE capture_export_requests ADD COLUMN completed_at TEXT;
ALTER TABLE capture_export_requests ADD COLUMN failed_at TEXT;
ALTER TABLE capture_export_requests ADD COLUMN cancelled_at TEXT;
ALTER TABLE capture_export_requests ADD COLUMN failure_reason TEXT;
ALTER TABLE capture_export_requests ADD COLUMN duration_seconds INTEGER;
ALTER TABLE capture_export_requests ADD COLUMN output_filename TEXT;
ALTER TABLE capture_export_requests ADD COLUMN file_size_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_capture_export_requests_queued_at
ON capture_export_requests(queued_at);

CREATE INDEX IF NOT EXISTS idx_capture_export_requests_completed_at
ON capture_export_requests(completed_at);