CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connectivity_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    target TEXT NOT NULL,
    target_type TEXT NOT NULL,
    success INTEGER NOT NULL,
    latency_ms REAL,
    packet_loss_pct REAL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_connectivity_target_type_timestamp
ON connectivity_checks (target_type, timestamp DESC);

CREATE TABLE IF NOT EXISTS dns_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    domain TEXT NOT NULL,
    resolver TEXT NOT NULL,
    success INTEGER NOT NULL,
    response_time_ms REAL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_dns_timestamp
ON dns_checks (timestamp DESC);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    mac_address TEXT,
    hostname TEXT,
    first_seen TEXT,
    last_seen TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_last_seen
ON devices (last_seen DESC);
