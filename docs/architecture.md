# Architecture

Lag Rat is a local observability system for home-network diagnostics.

It is built around three main layers:

1. collector and monitoring logic
2. local storage and aggregation
3. local API and dashboard presentation

---

## High-level architecture

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

---

## Main runtime flow

1. Scheduled monitors run connectivity, DNS, and device checks.
2. Raw observations are persisted in SQLite.
3. Derived lifecycle state is updated:
   - outages open and recover
   - alerts open, escalate, acknowledge, and resolve
   - device history records are appended
4. Aggregation queries build status, metrics, and report views.
5. Axum serves local REST endpoints.
6. The React dashboard renders overview, alerts, reports, metrics, devices, and detail drawers.

---

## Backend responsibilities

The backend owns:

- scheduled probe execution
- connectivity checks
- DNS checks
- device discovery / ingestion
- persistence
- outage lifecycle updates
- alert lifecycle updates
- history/event recording
- summary/report aggregation
- local API delivery

### Current backend domains

#### Connectivity
- router TCP probe
- internet TCP probe
- internet HTTP probe

#### DNS
- DNS lookup timing
- DNS success/failure recording
- DNS outage linkage

#### Devices
- device upsert flow
- known device labeling
- device history events
- local host registration and inventory parsing

#### Incident state
- outage open/recover lifecycle
- alert open/escalate/acknowledge/resolve lifecycle
- alert history timeline

#### Reporting
- reports summary
- report trends
- recent alert events
- recent device changes
- top incident targets
- metrics summary
- snapshot export payload

---

## Frontend responsibilities

The frontend owns:

- dashboard navigation
- current-state presentation
- chart rendering
- filtering and search
- report/export workflows
- incident drill-down drawers
- operator-friendly copy for primary surfaces

### Current dashboard surfaces

- Overview
- Alerts
- Reports
- Metrics
- Devices

### Current UI patterns

- shared `SideDrawer` shell
- shared `DrawerDetailSection`
- card-level loading / empty / error states
- time-window controls for reports and metrics
- list/table surfaces with friendlier wording
- drawers retaining raw technical detail

---

## Storage model

SQLite is the system of record for:

- raw connectivity checks
- raw DNS checks
- outages
- alerts
- alert history
- devices
- device history
- known devices
- schema migration tracking

The database supports both raw-event storage and higher-level dashboard aggregation.

---

## Design direction

Lag Rat is currently in a productization phase.

That means architectural emphasis is now on:

- preserving continuity
- keeping the backend contract stable
- making the dashboard easier to trust
- separating operator-friendly surface language from technical drawer detail
- improving cohesion without redesigning from scratch

---

## Not yet implemented

These are not yet core architectural modules:

- Wi-Fi signal mapping
- Prometheus export
- Docker packaging
- PCAP/packet analysis
- cloud sync / remote access
- richer notification channels
