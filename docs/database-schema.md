# Database Schema

Lag Rat uses SQLite as its local persistence layer.

The schema now supports both raw probe storage and higher-level incident/reporting workflows.

---

## Core tables

### `connectivity_checks`
Stores connectivity probe results.

Fields:
- `id`
- `timestamp`
- `target`
- `target_type`
- `success`
- `latency_ms`
- `packet_loss_pct`
- `error_message`
- `probe_kind`

Notes:
- used for router TCP, internet TCP, and internet HTTP probes
- feeds health history, summaries, alerts, outages, and metrics summaries

---

### `dns_checks`
Stores DNS lookup results.

Fields:
- `id`
- `timestamp`
- `domain`
- `resolver`
- `success`
- `response_time_ms`
- `error_message`

Notes:
- feeds DNS history, summaries, alerts, outages, and metrics summaries

---

### `outages`
Tracks outage lifecycle records.

Fields:
- `id`
- `outage_type`
- `target`
- `started_at`
- `ended_at`
- `is_active`
- `start_error`
- `end_note`

Notes:
- opened when a probe begins failing
- closed when the probe recovers
- used by reports, explorer tables, top incidents, and snapshot export

---

### `alerts`
Tracks alert lifecycle state.

Fields:
- `id`
- `alert_type`
- `severity`
- `entity_type`
- `entity_key`
- `message`
- `is_active`
- `created_at`
- `resolved_at`
- `acknowledged_at`

Notes:
- supports active/resolved views
- severity may change over time
- acknowledgment is tracked explicitly

---

### `alert_history`
Stores alert lifecycle history events.

Fields:
- `id`
- `alert_id`
- `event_type`
- `previous_value`
- `new_value`
- `created_at`

Typical event types:
- `opened`
- `severity_changed`
- `message_changed`
- `acknowledged`
- `resolved`

Notes:
- powers alert timeline drawers
- powers recent report alert events

---

### `devices`
Stores current device records.

Fields:
- `id`
- `ip_address`
- `mac_address`
- `hostname`
- `first_seen`
- `last_seen`

Notes:
- updated by device ingestion/upsert flow
- used to build enriched device views

---

### `device_history`
Stores device lifecycle/change events.

Fields:
- `id`
- `device_ip_address`
- `event_type`
- `previous_value`
- `new_value`
- `created_at`

Typical event types:
- `first_seen`
- `seen_again`
- `mac_changed`
- `hostname_changed`
- `label_changed`
- `label_added`
- `notes_changed`

Notes:
- powers device detail timelines
- powers recent report device events

---

### `known_devices`
Stores user-defined device labels and notes.

Fields:
- `id`
- `ip_address`
- `mac_address`
- `label`
- `notes`
- `created_at`
- `updated_at`

Notes:
- used to enrich device display names
- includes seeded router label support

---

### `schema_migrations`
Tracks applied migrations.

Fields:
- `version`
- `applied_at`

---

## Schema role in the product

The schema supports three layers of usage:

1. **raw probe storage**
   - connectivity checks
   - DNS checks

2. **derived incident state**
   - outages
   - alerts
   - alert history
   - device history

3. **operator-facing summaries**
   - reports summary
   - report trends
   - metrics summary
   - recent event panels
   - snapshot export

---

## Current status

The schema is beyond initial draft stage and already supports:

- multi-probe connectivity storage
- outage lifecycle tracking
- alert acknowledgment
- alert history
- known device labeling
- device history
- report and metrics aggregation queries
