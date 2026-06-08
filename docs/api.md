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

The current API serves four broad categories:

- operational status
- historical probe data
- incidents and alerts
- reports and metrics summaries

---

## Status

### `GET /api/status/overview`

Returns a dashboard-oriented operational summary including:

- router health
- internet health
- HTTP probe health
- TCP probe health
- DNS health
- device activity summary
- outage summary
- alert summary

### `GET /api/health/current`

Returns the latest current health state including:

- router reachable
- internet reachable
- DNS healthy
- latest check timestamp

---

## Historical probe data

### `GET /api/health/history?minutes=60`

Returns time-series latency data for the internet HTTP probe.

### `GET /api/health/history/tcp?minutes=60`

Returns time-series latency data for the internet TCP probe.

### `GET /api/dns/history?minutes=60`

Returns time-series DNS response-time data.

### `GET /api/stats/summary`

Returns a compact 24-hour summary including:

- uptime percentage
- average latency
- outage count

---

## Alerts

### `GET /api/alerts`

Lists alerts with optional filters.

Supported query params:

- `status=active|resolved`
- `severity=critical|warning|info`
- `entity_type=router|internet|dns|...`
- `search=<text>`
- `limit=<n>`

### `POST /api/alerts/{id}/acknowledge`

Acknowledges an active alert and returns the updated alert record.

### `GET /api/alerts/{id}/history`

Returns lifecycle history for a single alert.

Typical events include:

- opened
- severity changed
- message changed
- acknowledged
- resolved

---

## Outages

### `GET /api/outages`

Lists outages with optional filters.

Supported query params:

- `status=active|resolved`
- `outage_type=internet_http|internet_tcp|dns|router`
- `search=<text>`
- `limit=<n>`

Returned items include:

- outage type
- target
- started at
- ended at
- active/resolved state
- start error
- recovery note
- computed duration
- normalized status string

---

## Devices

### `GET /api/devices`

Returns enriched devices for the dashboard, including label and confidence information.

By default, low-confidence devices are hidden from the API response to keep the device list focused on stronger observations.

Supported query params:

- `include_low_confidence=true`

When `include_low_confidence=true` is provided, the API includes low-confidence devices such as incomplete ARP/neighbour entries or weakly identified observations.

### `POST /api/devices/known`

Creates or updates a known device label record.

Request body:

```json
{
  "ip_address": "192.168.1.20",
  "mac_address": null,
  "label": "Office laptop",
  "notes": "Main work machine"
}
```

### `GET /api/devices/{ip}/history`

Returns historical device events for a single IP.

---

## Reports

### `GET /api/reports/summary?hours=24`

Returns summary metrics for the selected reporting window.

Fields include:

- uptime percentage
- average latency
- outage count
- total downtime
- DNS failure count
- device history event count
- active alert count
- active critical alert count
- active unacknowledged alert count

### `GET /api/reports/trends?hours=24`

Returns bucketed report trend data for charts.

Fields include per-bucket counts for:

- outages
- DNS failures
- internet HTTP failures
- internet TCP failures

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

## Capture export requests

Capture export requests are local operator handoff records created from traffic workflows.

Lag Rat can optionally queue and execute guarded local `tcpdump` captures when execution is enabled, but it does not inspect packet contents.

Device-scoped capture requests can be created from the Device detail drawer.
These requests use device metadata such as `device_ip_address` or `mac_address` so the backend can build safe `tcpdump` filters internally. The frontend does not send raw packet-capture filter strings.

### `GET /api/captures/readiness`

Returns local capture execution readiness for the dashboard.

This endpoint does not run a packet capture. It reports whether guarded capture execution is enabled, whether required local tooling is available, whether the output directory is ready, which interfaces are allowed, and which operator actions are needed before queueing captures.

Returned fields include:

- `execution_enabled`
- `can_execute`
- `tcpdump_available`
- `output_directory_ready`
- `duration_bounds_valid`
- `allowed_interfaces_valid`
- `allowed_interfaces`
- `output_dir`
- `default_duration_seconds`
- `min_duration_seconds`
- `max_duration_seconds`
- `max_file_mb`
- `issues`

### `POST /api/captures/export-requests`

Creates a capture export request.

Example request body:

```json
{
  "source": "traffic_top_talker",
  "interface_name": "eth0",
  "entity_type": "device",
  "entity_key": "192.168.1.20",
  "device_ip_address": "192.168.1.20",
  "window_minutes": 60,
  "note": "Inspect this top talker"
}
```

New requests start with `status = requested`.

### `GET /api/captures/export-requests?limit=20`

Lists recent capture export requests.

Returned records include request metadata, lifecycle status, timestamps, optional failure reason, and optional capture file metadata.

### `GET /api/captures/export-requests/{id}`

Returns a single capture export request.

Possible responses:

- `200 OK` — request found
- `404 Not Found` — request does not exist

### `POST /api/captures/export-requests/{id}/queue`

Moves a capture export request from `requested` to `queued`.

Possible responses:

- `200 OK` — request queued
- `404 Not Found` — request does not exist
- `409 Conflict` — request is not in a queueable state

### `POST /api/captures/export-requests/{id}/cancel`

Cancels a request in `requested`, `queued`, or `running` state.

Possible responses:

- `200 OK` — request cancelled
- `404 Not Found` — request does not exist
- `409 Conflict` — request is not in a cancellable state

### `DELETE /api/captures/export-requests/{id}`

Deletes a capture export request from Lag Rat history.

If the request has a valid `capture_reference`, Lag Rat also attempts to delete the referenced local `.pcap` file.

Safety rules:

- requests with `status = running` cannot be deleted
- only Lag Rat capture files under `CAPTURE_OUTPUT_DIR` can be removed
- arbitrary paths are rejected
- packet contents are not parsed or inspected

Example response:

```json
{
  "id": 12,
  "deleted": true,
  "file_deleted": false
}
```

Possible responses:

- `200 OK` — request deleted
- `404 Not Found` — request does not exist
- `409 Conflict` — request is currently running
- `500 Internal Server Error` — cleanup failed unexpectedly

### Dashboard workflow notes

The Traffic page uses these endpoints to support the capture request workflow.

Dashboard behavior includes:

- capture request history on the Traffic page
- lifecycle status chips for quick status counts and filtering
- status, source, and search filters
- a clear filters action
- compact and comfortable table density modes
- a capture request detail drawer
- `captureRequestId` query-param deep links for restoring the drawer
- queue, cancel, and delete actions from table rows and the detail drawer
- confirmation before deleting request history or matching local `.pcap` files

The dashboard remains a metadata and handoff surface. Packet-content inspection should still happen externally through tools such as `tcpdump` or Wireshark.

---

## Maintenance

### `POST /api/maintenance/clear-observations`

Clears local runtime observation data while preserving user-defined configuration-like data.

This endpoint is intended for local operator reset workflows during testing, demos, or cleanup after long-running observation sessions.

Request body:

```json
{
  "confirmation": "CLEAR OBSERVATIONS"
}
```

The confirmation phrase is required. Requests with any other confirmation value are rejected.

Cleared runtime data includes:

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

Preserved data includes:

- known device labels and notes
- schema migrations

Capture file cleanup:

- Lag Rat attempts to delete guarded local capture files under CAPTURE_OUTPUT_DIR
- only Lag Rat-owned capture files matching the capture filename pattern are removed
- arbitrary files and paths are not deleted

Example response:

```json
{
  "cleared": true,
  "tables": [
    {
      "table": "connectivity_checks",
      "deleted_rows": 120
    },
    {
      "table": "dns_checks",
      "deleted_rows": 60
    }
  ],
  "total_deleted_rows": 180,
  "capture_files_deleted": 2
}
```

Possible responses:

- 200 OK — observations cleared
- 400 Bad Request — confirmation phrase is missing or incorrect
- 500 Internal Server Error — database cleanup or guarded capture file cleanup failed unexpectedly

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

- Wi-Fi sampling data
- traffic summary endpoints
- optional capture/export endpoints
- Bitcoin node observability summaries
- Lightning observability summaries

The goal is to keep the dashboard contract familiar even as new observability modules are added.

---

## Notes

- This API is local-first and intended for dashboard use.
- Query parameters are currently simple and operator-focused.
- Reports and metrics endpoints form part of the stable dashboard-facing contract.

---

## Maintenance notes

When updating this file:

- add new endpoints under the relevant domain section
- keep shared platform patterns separate from module-specific resources
- document current implemented behavior first
- place speculative or future endpoints only in **Future API direction**
- prefer small edits over large rewrites

```

```

```

```
