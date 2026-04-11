# Lag Rat

A home-network observability platform for monitoring connectivity, latency, DNS health, outages, alerts, and local device activity through a Rust backend and a React + TypeScript dashboard.

**Lag Rat** uses a **Rust backend** for scheduled probe collection, persistence, summaries, and local API delivery, and a **React + TypeScript dashboard** for operational visibility, trends, reports, and incident drill-down.

---

## 1. Current Project Status

Lag Rat is no longer in planning or initial scaffolding.

The project is currently in a **late MVP / early productization** stage:

- core monitoring is implemented
- local persistence and API endpoints are implemented
- dashboard pages for overview, alerts, reports, metrics, and devices exist
- incident drawers and detail surfaces have been refactored toward shared UI patterns
- backend integration tests now cover alert lifecycle, outages, overview, and reports/metrics APIs
- current work is focused on cohesion, wording, consistency, and operator usability

In short: the system works end-to-end and the main work now is refinement rather than invention.

---

## 2. What Has Been Implemented

### Backend
- Rust backend with Axum, Tokio, SQLx, and SQLite
- scheduled connectivity checks
- scheduled DNS checks
- device inventory ingestion and persistence
- outage tracking with open / recover lifecycle
- alert lifecycle with debounce and severity escalation
- alert acknowledgment support
- alert history persistence and API
- report summary aggregation
- report trend aggregation
- metrics summary aggregation
- recent alert event aggregation
- recent device event aggregation
- top incident target aggregation
- report snapshot export endpoint

### API surface
Implemented local API endpoints include:

- `GET /api/status/overview`
- `GET /api/health/current`
- `GET /api/health/history`
- `GET /api/health/history/tcp`
- `GET /api/dns/history`
- `GET /api/stats/summary`
- `GET /api/reports/summary`
- `GET /api/metrics/summary`
- `GET /api/reports/snapshot`
- `GET /api/reports/trends`
- `GET /api/reports/alerts/recent`
- `GET /api/reports/devices/recent`
- `GET /api/reports/incidents/top`
- `GET /api/alerts`
- `POST /api/alerts/{id}/acknowledge`
- `GET /api/alerts/{id}/history`
- `GET /api/outages`
- `GET /api/devices`
- `POST /api/devices/known`
- `GET /api/devices/{ip}/history`

### Frontend
Implemented dashboard surfaces include:

- Overview
- Alerts
- Reports
- Metrics
- Devices
- detail drawers for alerts, outages, and devices

Implemented UI/reporting features include:

- reports summary cards
- reports trend charts
- recent alert events
- recent device changes
- top incident targets
- report narrative summary
- JSON export
- CSV export
- metrics page time window controls
- metrics summary strip
- chart-level loading / error / empty states
- shared drawer shell
- shared drawer detail section component
- humanized alert/outage/report copy on primary surfaces

---

## 3. Current Architecture

```text
[ Router / Internet / LAN Devices ]
                |
                v
        [ Rust Collector Service ]
                |
      +---------+----------+
      |                    |
      v                    v
[ SQLite / Metrics DB ]   [ Local API ]
                                |
                                v
                   [ React + TypeScript Dashboard ]
```

### Main flow
1. The backend runs scheduled connectivity, DNS, and device checks.
2. Results are stored in SQLite.
3. Aggregation queries compute status, trends, incident summaries, and report views.
4. Axum exposes local endpoints for both operational and summary/reporting data.
5. The React dashboard renders overview, incidents, metrics, and report workflows.
6. Drawers provide drill-down detail without leaving the current page context.

---

## 4. Stack

### Backend
- Rust
- Axum
- Tokio
- SQLx
- SQLite
- Serde
- Reqwest
- Tracing
- Tower HTTP
- Anyhow
- thiserror

### Frontend
- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Recharts
- Tailwind CSS
- shadcn/ui
- date-fns
- Zod

---

## 5. What Is Stable Right Now

These areas are established foundations:

- connectivity monitoring
- DNS monitoring
- outage lifecycle tracking
- device inventory with history
- alert lifecycle and acknowledgment flow
- alert history API + timeline UI
- reports summary and trends
- metrics summary
- reports snapshot export
- shared drawer patterns
- backend test coverage for alerts, outages, overview, and reports/metrics APIs

---

## 6. What Is Still In Progress

These areas are active polish/productization work:

- overview cohesion as the primary operator dashboard
- final consistency pass across reports, alerts, metrics, and drawers
- human-friendly wording on summary surfaces
- consistent no-data / empty / partial-failure states
- final metrics page state-handling improvements
- docs refresh to match implementation

---

## 7. What Has Not Been Built Yet

Future or optional work:

- Wi-Fi signal mapping
- room-by-room quality analysis
- packet capture / PCAP analysis
- Prometheus-compatible export
- Docker packaging
- remote access / cloud sync
- mobile-specific UI
- richer notification channels
- advanced device fingerprinting/vendor enrichment

---

## 8. Testing Status

Backend integration coverage currently includes:

- alerts lifecycle
- alert acknowledgment
- alert history APIs
- outages
- status overview
- reports summary
- metrics summary
- reports trends
- reports snapshot
- recent reports endpoints
- top incident targets

The next major testing opportunity is frontend state/component coverage for reports and metrics surfaces.

---

## 9. Current Priority

Current priority:

**turn the existing monitoring stack into a coherent, operator-friendly local observability product**

That means emphasis is on:

- consistency
- wording
- trust in summaries
- clear error/no-data handling
- dashboard cohesion

not major backend redesign.

---

## 10. Recommended Next Steps

Immediate next steps:

- finish the metrics page consistency/state-handling pass
- do a final overview cohesion pass
- align remaining summary surfaces to the humanized incident language model
- optionally add frontend tests for reports/metrics state handling
- refresh docs and screenshots

---

## 11. Status

**Status: implemented core platform, currently in dashboard polish / productization phase.**
