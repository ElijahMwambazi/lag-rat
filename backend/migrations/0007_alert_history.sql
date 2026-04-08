CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    previous_value TEXT NULL,
    new_value TEXT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(alert_id) REFERENCES alerts(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id_created_at
ON alert_history(alert_id, created_at DESC);