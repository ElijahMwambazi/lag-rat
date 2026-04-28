# Architecture

## Purpose

This document describes the current architecture of Lag Rat and the intended platform boundary for future expansion.

Lag Rat should be treated as a **local observability platform** with a current primary focus on **home network observability**.

---

## Core layers

Lag Rat is built around three main layers:

1. collector and monitoring logic
2. local storage and aggregation
3. local API and dashboard presentation

---

## High-level architecture

```text
[ Router / Internet / LAN Devices / Wi-Fi Environment ]
                         |
                         v
               [ Rust Collector Service ]
                         |
           +-------------+-------------+
           |                           |
           v                           v
   [ SQLite / Aggregation DB ]      [ Local API ]
                                         |
                                         v
                            [ React + TypeScript Dashboard ]
```

---

## Main runtime flow

1. Scheduled monitors run connectivity, DNS, device, and Wi-Fi sampling checks.
2. Raw observations are persisted in SQLite.
3. Derived lifecycle state is updated:
   - outages open and recover
   - alerts open, escalate, acknowledge, and resolve
   - device history records are appended
   - Wi-Fi signal weakness and stale-sample alerts are evaluated
4. Aggregation and read-model queries build status, metrics, report, Wi-Fi, traffic, and investigation views.
5. Axum serves local REST endpoints.
6. The React dashboard renders overview, alerts, reports, metrics, devices, Wi-Fi, and detail drawers.

---

## Platform boundary

Lag Rat should be treated as a small observability platform with a shared core and pluggable collector/modules.

### Shared platform responsibilities

The shared platform should own:

- scheduling and collector execution
- persistence
- incident lifecycle primitives
- alerts and history timelines
- report aggregation
- local API delivery
- dashboard presentation patterns
- investigation read models

### Module responsibilities

Each module should own:

- its own observation/collection logic
- module-specific targets and identifiers
- module-specific summaries
- module-specific drill-down details

---

## Current module

The current implemented module is **home network observability**.

It currently covers:

- router TCP reachability
- internet TCP reachability
- internet HTTP reachability
- DNS checks
- device inventory/activity
- outages and alerts
- reports and metrics summaries
- room-based Wi-Fi sampling
- room-level Wi-Fi health summaries and timelines
- traffic summaries / top talkers
- incident investigations

---

## Backend responsibilities

The backend currently owns:

- scheduled probe execution
- connectivity checks
- DNS checks
- device discovery / ingestion
- Wi-Fi sample ingest
- persistence
- outage lifecycle updates
- alert lifecycle updates
- history/event recording
- summary/report aggregation
- local API delivery
- traffic sample aggregation
- investigation read-model composition

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

#### Wi-Fi

- Wi-Fi sample ingest and persistence
- latest-sample lookup
- windowed Wi-Fi summaries
- per-location summary rollups
- weak-signal alert evaluation
- stale-sample freshness evaluation

#### Traffic

- traffic summary aggregation
- top talker ranking
- recent traffic sample retrieval
- device/interface traffic context for investigations

#### Investigations

- incident-target investigation read model
- related outage lookup
- related recent alert-event lookup
- likely device candidate lookup
- traffic context lookup
- Wi-Fi context lookup
- operator summary fields for investigation drawers

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

The frontend currently owns:

- dashboard navigation
- current-state presentation
- chart rendering
- filtering and search
- report/export workflows
- incident drill-down drawers
- operator-friendly copy for primary surfaces
- Wi-Fi room comparison, sample inspection, and room-specific incident flows

### Current dashboard surfaces

- Overview
- Alerts
- Reports
- Metrics
- Devices
- Wi-Fi
- Traffic
- Investigation drawers

### Current UI patterns

- shared `SideDrawer` shell
- shared `DrawerDetailSection`
- card-level loading / empty / error states
- time-window controls for reports, metrics, and Wi-Fi
- list/table surfaces with friendlier wording
- drawers retaining raw technical detail
- collapsible inspection sections for dense module-specific workflows

---

## Storage model

SQLite is currently the system of record for:

- raw connectivity checks
- raw DNS checks
- outages
- alerts
- alert history
- devices
- device history
- known devices
- Wi-Fi samples
- schema migration tracking
- traffic samples or traffic observations

The database supports both raw-event storage and higher-level dashboard aggregation.

---

## Design direction

Lag Rat is currently in a productization phase.

Architectural emphasis is now on:

- preserving continuity
- keeping the backend contract stable
- making the dashboard easier to trust
- separating operator-friendly surface language from technical drawer detail
- improving cohesion without redesigning from scratch
- defining a clean collector/plugin boundary for future observability domains
- using Wi-Fi as the first richer module workflow built on shared alert/report primitives

---

## Near-term additions

These are the most likely next architectural extensions:

- traffic observability hardening
- investigation workflow refinement
- optional packet capture export hooks
- clearer collector/plugin boundaries

---

## Future modules

The architecture should leave room for future modules such as:

- traffic summaries / top talkers
- Bitcoin node observability
- Lightning observability

---

## Not yet implemented

These are not yet core architectural modules or completed platform capabilities:

- optional packet capture export
- Prometheus-compatible export
- Docker packaging
- PCAP/packet analysis inside Lag Rat
- cloud sync / remote access
- richer notification channels
- Bitcoin node observability
- Lightning observability

Recommended separation:

- Lag Rat: operational observability and summaries
- discovery tools: inventory enrichment
- packet capture tools: deep forensic analysis
- Wireshark: external protocol-level drill-down
