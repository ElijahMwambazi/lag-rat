# API

## Purpose

This document describes the current local HTTP API exposed by Lag Rat for the dashboard and other local operator-facing workflows.

Lag Rat is a **local observability platform** with a current primary focus on **home network observability**.

The current API is therefore primarily the API surface of the **network observability module**, which is the first implemented module in the platform.

## Base URL

During local development:

```text
http://127.0.0.1:8080
```

## Current API shape

The current API serves seven broad categories:

- operational status
- historical probe data
- incidents and alerts
- reports and metrics summaries
- Wi-Fi sample and room-health workflows
- traffic summaries and top talkers
- investigation read models

---

## Status

### `GET /api/overview`

Returns the main dashboard overview payload, including:

- current health cards
- active outage summary
- active alert summary
- recent device summary
- Wi-Fi summary block when available

---

## Alerts

### `GET /api/alerts`

Returns filtered alerts.

Common query parameters:

- `severity`
- `status`
- `entity_type`
- `limit`

### `POST /api/alerts/{id}/acknowledge`

Acknowledges an active alert.

### `GET /api/alerts/{id}/history`

Returns alert lifecycle events for a single alert.

Typical event types:

- `opened`
- `severity_changed`
- `message_changed`
- `acknowledged`
- `resolved`

---

## Devices

### `GET /api/devices`

Returns enriched current device inventory.

### `GET /api/devices/history`

Returns device lifecycle/change history.

---

## Outages

### `GET /api/outages`

Returns outage records.

Common query parameters:

- `hours`
- `status`
- `type`
- `target`
- `limit`

---

## Investigations

### `GET /api/investigations?incident_type=internet_http&target=https%3A%2F%2Fexample.com&hours=24`

Returns a backend-composed investigation read model for an incident target.

The investigation payload includes:

- investigation subject
- related outages
- recent alert events
- likely device candidates
- traffic context
- Wi-Fi context
- operator summary fields

Current subject shape:

```json
{
  "kind": "incident_target",
  "incident_type": "internet_http",
  "target": "https://example.com",
  "window_hours": 24
}
```

Current summary shape:

```json
{
  "primary_signal": "string",
  "next_check": "string",
  "supporting_context": "string"
}
```

---

## Reports

### `GET /api/reports/summary?hours=24`

Returns report summary counts for the selected report window.

### `GET /api/reports/trends?hours=24`

Returns trend buckets for outages and failures over the selected report window.

### `GET /api/reports/alerts/recent?hours=24`

Returns recent alert lifecycle events for the selected report window.

### `GET /api/reports/devices/recent?hours=24`

Returns recent device history events for the selected report window.

### `GET /api/reports/incidents/top?hours=24`

Returns ranked incident targets for the selected report window.

### `GET /api/reports/snapshot?hours=24`

Returns an export-oriented composite report payload containing:

- generated timestamp
- window hours
- narrative summary
- report summary block
- top incident targets
- recent alert events
- recent device events
- outage items

---

## Metrics

### `GET /api/metrics/summary?minutes=60`

Returns probe-level summary metrics for the selected operational window.

Current summary items include:

- Internet HTTP
- Internet TCP
- DNS

Each item includes:

- total checks
- success count
- failure count
- success rate
- average latency
- latest latency
- last checked timestamp

---

## Traffic

### `GET /api/traffic/summary?minutes=60`

Returns traffic totals for the selected operational window.

Fields include:

- `window_minutes`
- `total_bytes_rx`
- `total_bytes_tx`
- `total_bytes`
- `interface_count`
- `top_talker`

### `GET /api/traffic/top-talkers?minutes=60&limit=5`

Returns ranked traffic entities for the selected window.

Each item includes:

- `interface_name`
- `entity_type`
- `entity_key`
- `device_ip_address`
- `mac_address`
- latest RX/TX counters
- earliest RX/TX counters
- RX/TX deltas
- total byte delta
- latest sample timestamp

### `GET /api/traffic/samples?minutes=60&limit=20`

Returns recent traffic samples.

Each item includes:

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

---

## Wi-Fi

### `GET /api/wifi/samples?minutes=60&location_label=office&limit=50`

Returns recent Wi-Fi samples ordered newest first.

Supported query parameters:

- `minutes`
- `location_label` (optional)
- `limit` (optional)

Each item includes:

- `id`
- `location_label`
- `interface_name`
- `ssid`
- `bssid`
- `rssi_dbm`
- `frequency_mhz`
- `band`
- `sampled_at`

### `GET /api/wifi/latest`

Returns the newest Wi-Fi sample across all locations.

Returns `404` when no Wi-Fi samples exist.

### `GET /api/wifi/summary?minutes=60&location_label=office`

Returns a windowed Wi-Fi rollup for all locations or a single location.

Fields include:

- `window_minutes`
- `location_label`
- `latest_sample`
- `sample_count`
- `avg_rssi_dbm`
- `min_rssi_dbm`
- `max_rssi_dbm`

### `GET /api/wifi/locations`

Returns distinct Wi-Fi location labels.

Response shape:

- `items: string[]`

### `GET /api/wifi/locations/summary?minutes=60`

Returns per-location Wi-Fi summary items for the selected window.

Each item includes:

- `location_label`
- `latest_sample`
- `sample_count`
- `avg_rssi_dbm`
- `min_rssi_dbm`
- `max_rssi_dbm`

---

## Current module scope

Today, this API is primarily the API contract for the **home network observability** module.

That includes:

- router monitoring
- internet monitoring
- DNS monitoring
- device activity
- outages
- alerts
- reports
- metrics
- Wi-Fi room health and sample workflows
- traffic summaries and top talkers
- incident investigation read models

---

## Future API direction

As Lag Rat grows into a broader observability platform, API expansion will likely follow two patterns.

### Shared platform patterns

These should stay familiar across modules:

- alerts
- histories / timelines
- reports
- metrics summaries

### Module-specific resources

These may expand over time:

- optional packet capture/export endpoints
- optional capture/export endpoints
- Bitcoin node observability summaries
- Lightning observability summaries

The goal is to keep the dashboard contract familiar even as new observability modules are added.

---

## Notes

- This API is local-first and intended for dashboard use.
- Query parameters are currently simple and operator-focused.
- Reports, metrics, and Wi-Fi endpoints form part of the stable dashboard-facing contract.

```

```
