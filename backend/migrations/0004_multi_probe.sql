ALTER TABLE connectivity_checks ADD COLUMN probe_kind TEXT DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_connectivity_probe_kind_timestamp
ON connectivity_checks (probe_kind, timestamp DESC);
