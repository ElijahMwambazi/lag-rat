CREATE TABLE IF NOT EXISTS known_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT,
    mac_address TEXT,
    label TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_known_devices_ip ON known_devices (ip_address);
CREATE INDEX IF NOT EXISTS idx_known_devices_mac ON known_devices (mac_address);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (entity_type, entity_key, is_active);
