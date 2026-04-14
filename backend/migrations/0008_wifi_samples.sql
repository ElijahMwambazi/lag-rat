CREATE TABLE IF NOT EXISTS wifi_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_label TEXT NOT NULL,
    interface_name TEXT NOT NULL,
    ssid TEXT,
    bssid TEXT,
    rssi_dbm INTEGER,
    frequency_mhz INTEGER,
    band TEXT,
    sampled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wifi_samples_location_sampled_at
ON wifi_samples(location_label, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_wifi_samples_sampled_at
ON wifi_samples(sampled_at DESC);