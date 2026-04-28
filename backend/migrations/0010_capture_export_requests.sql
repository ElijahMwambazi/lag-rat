CREATE TABLE IF NOT EXISTS capture_export_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    interface_name TEXT,
    entity_type TEXT,
    entity_key TEXT,
    device_ip_address TEXT,
    mac_address TEXT,
    window_minutes INTEGER,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    capture_reference TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capture_export_requests_created_at
ON capture_export_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_capture_export_requests_status
ON capture_export_requests(status);

CREATE INDEX IF NOT EXISTS idx_capture_export_requests_entity
ON capture_export_requests(entity_type, entity_key);