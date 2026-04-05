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

CREATE TABLE IF NOT EXISTS dns_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    domain TEXT NOT NULL,
    resolver TEXT NOT NULL,
    success INTEGER NOT NULL,
    response_time_ms REAL,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    mac_address TEXT,
    hostname TEXT,
    first_seen TEXT,
    last_seen TEXT
);
