CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outage_type TEXT NOT NULL,
    target TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_error TEXT,
    end_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_outages_active
ON outages (outage_type, target, is_active);

CREATE INDEX IF NOT EXISTS idx_outages_started_at
ON outages (started_at DESC, is_active);
