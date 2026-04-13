# Database Schema

## Purpose

This document describes the current persistence model used by Lag Rat.

Lag Rat uses SQLite as its local persistence layer.

The current schema primarily supports the **home network observability** module while also establishing shared platform primitives for incidents, histories, reports, and metrics.

---

## Current schema role

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

### `schema_migrations`

Tracks applied migrations.

Fields:

- `version`
- `applied_at`

---

## Shared platform primitives vs current module data

### Shared platform primitives

These tables already behave like shared observability-platform primitives:

- outages
- alerts
- alert_history
- device_history
- schema_migrations

### Current network module data

These tables are currently specific to the first implemented module:

- connectivity_checks
- dns_checks
- devices
- known_devices

Future modules should reuse shared incident/reporting patterns where possible rather than inventing separate lifecycle models.

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

---

## Planned schema extensions

### Wi-Fi sampling tables

Possible fields:

- location_label
- rssi_dbm
- band
- latency_ms
- packet_loss_pct
- sampled_at

### Traffic summary tables

Possible fields:

- device or interface identifier
- bytes sent/received
- packets sent/received
- observation window
- protocol or category summary

### Optional capture/export metadata

Near-term direction should favor export hooks and metadata over full packet storage inside Lag Rat.

Possible fields:

- export_type
- export_path or export_reference
- capture_started_at
- capture_ended_at
- related_device or target
- related_incident_id

---

## Maintenance notes

When updating this file:

- keep current implemented tables separate from planned extensions
- treat shared incident/history/report patterns as platform primitives
- add new module-specific tables under planned extensions until they are implemented
- prefer documenting current usage before speculative schema design
- prefer additive edits over large restructuring
