CREATE TABLE IF NOT EXISTS traffic_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interface_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    device_ip_address TEXT,
    mac_address TEXT,
    bytes_rx INTEGER NOT NULL,
    bytes_tx INTEGER NOT NULL,
    packets_rx INTEGER,
    packets_tx INTEGER,
    sampled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_samples_sampled_at
ON traffic_samples(sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_traffic_samples_interface_name
ON traffic_samples(interface_name);

CREATE INDEX IF NOT EXISTS idx_traffic_samples_entity_key
ON traffic_samples(entity_key);