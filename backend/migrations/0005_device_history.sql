CREATE TABLE IF NOT EXISTS device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_ip_address TEXT NOT NULL,
    event_type TEXT NOT NULL,
    previous_value TEXT NULL,
    new_value TEXT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_history_ip_created_at
ON device_history(device_ip_address, created_at DESC);