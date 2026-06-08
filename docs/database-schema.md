# Database Schema

## Purpose

This document describes the current persistence model used by Lag Rat.

Lag Rat uses SQLite as its local persistence layer.

The current schema primarily supports the **home network observability** module while also establishing shared platform primitives for incidents, histories, reports, metrics, investigations, and local capture handoff workflows.

---

## Current schema role

The schema supports three layers of usage:

1. **raw probe storage**
   - connectivity checks
   - DNS checks
   - Wi-Fi samples
   - traffic samples

2. **derived incident state**
   - outages
   - alerts
   - alert history
   - device history
   - capture export request lifecycle state
   - maintenance reset workflows for runtime observations

3. **operator-facing summaries**
   - reports summary
   - report trends
   - metrics summary
   - Wi-Fi summaries
   - traffic summaries and top talkers
   - investigation context
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
- used by reports, explorer tables, top incidents, investigation drawers, and snapshot export

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
- used across overview, alerts, reports, Wi-Fi, and investigation workflows

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
- provides metadata for device-scoped capture requests

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

### `wifi_samples`

Stores room/location-labeled Wi-Fi observations.

Fields:

- `id`
- `location_label`
- `interface_name`
- `ssid`
- `bssid`
- `rssi_dbm`
- `frequency_mhz`
- `band`
- `sampled_at`

Notes:

- powers Wi-Fi latest sample, sample history, summaries, and per-location comparison
- supports weak-signal and stale-sample alert workflows
- keeps room/location labels as operator-controlled context

### `traffic_samples`

Stores traffic counter observations.

Fields:

- `id`
- `interface_name`
- `entity_type`
- `entity_key`
- `device_ip_address`
- `mac_address`
- `bytes_rx`
- `bytes_tx`
- `packets_rx`
- `packets_tx`
- `sampled_at`

Notes:

- powers traffic summary, top talkers, recent samples, and traffic detail drawers
- supports interface-level and device-scoped traffic context
- provides source metadata for capture export request workflows

### `capture_export_requests`

Stores capture export request metadata and lifecycle state.

Fields:

- `id`
- `source`
- `interface_name`
- `entity_type`
- `entity_key`
- `device_ip_address`
- `mac_address`
- `window_minutes`
- `note`
- `status`
- `capture_reference`
- `created_at`
- `queued_at`
- `started_at`
- `completed_at`
- `failed_at`
- `cancelled_at`
- `failure_reason`
- `duration_seconds`
- `output_filename`
- `file_size_bytes`

Notes:

- records capture handoff metadata, not packet contents
- supports requested, queued, running, completed, failed, and cancelled lifecycle states
- stores local `.pcap` references for completed captures
- supports guarded cleanup of Lag Rat-owned capture files
- supports stale running request recovery
- supports device-scoped capture requests using safe backend-generated IP or MAC filters

### `schema_migrations`

Tracks applied migrations.

Fields:

- `version`
- `applied_at`

---

## Maintenance reset behavior

Lag Rat supports clearing runtime observation data without resetting the whole local database.

The clear-observations workflow removes data from runtime/observation tables such as:

- connectivity checks
- DNS checks
- outages
- alerts
- alert history
- discovered devices
- device history
- Wi-Fi samples
- traffic samples
- capture export requests

The workflow intentionally preserves:

- `known_devices`
- `schema_migrations`

Known devices are preserved because user-defined labels and notes behave more like local configuration than raw observations.

Schema migrations are preserved because they represent database structure state and should not be removed by operator cleanup workflows.

Capture files are not stored in SQLite, but clear-observations also attempts guarded cleanup of Lag Rat-owned `.pcap` files under `CAPTURE_OUTPUT_DIR`.

---

## Shared platform primitives vs current module data

### Shared platform primitives

These tables already behave like shared observability-platform primitives:

- outages
- alerts
- alert_history
- device_history
- capture_export_requests
- schema_migrations

### Current network module data

These tables are currently specific to the first implemented module:

- connectivity_checks
- dns_checks
- devices
- known_devices
- wifi_samples
- traffic_samples

Future modules should reuse shared incident/reporting/capture-handoff patterns where possible rather than inventing separate lifecycle models.

---

## Current status

The schema is beyond initial draft stage and already supports:

- multi-probe connectivity storage
- outage lifecycle tracking
- alert acknowledgment
- alert history
- known device labeling
- device history
- Wi-Fi sample persistence and summaries
- traffic sample persistence and top-talker read models
- report and metrics aggregation queries
- investigation context across incidents, alerts, devices, traffic, and Wi-Fi
- capture export request persistence and lifecycle tracking
- guarded local capture reference metadata and cleanup

---

## Planned schema extensions

### Wi-Fi sampling tables

Implemented as current module data.

Current fields include:

- location_label
- interface_name
- ssid
- bssid
- rssi_dbm
- frequency_mhz
- band
- sampled_at

### Traffic summary tables

Implemented through traffic sample storage and read-model aggregation.

Current fields include:

- interface identifier
- entity type and key
- optional device IP or MAC
- bytes sent/received
- packets sent/received
- sampled timestamp

### Optional capture/export metadata

Implemented as capture export request metadata and lifecycle state.

Current fields include:

- capture source
- interface name
- related entity or device
- capture status
- capture reference
- output filename
- file size
- lifecycle timestamps
- failure reason

---

## Maintenance notes

When updating this file:

- keep current implemented tables separate from planned extensions
- treat shared incident/history/report/capture-handoff patterns as platform primitives
- add new module-specific tables under planned extensions until they are implemented
- prefer documenting current usage before speculative schema design
- prefer additive edits over large restructuring
