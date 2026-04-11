# API

Lag Rat exposes a local HTTP API used by the React dashboard.

Base URL during local development:

```text
http://127.0.0.1:8080
```

The API currently serves four broad categories:

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
Returns the latest high-level current health state:

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
Returns a compact 24-hour summary:

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
Returns lifecycle history for a single alert, including events such as:

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

## Notes

- This API is local-first and intended for dashboard use.
- Query parameters are currently simple and operator-focused.
- Reports and metrics endpoints are now integration-tested and form part of the stable dashboard contract.
