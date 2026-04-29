# Lag Rat

Lag Rat is a **local observability platform** with a current primary focus on **home network observability**.

Today, the first implemented module is network monitoring for:

- router reachability
- internet connectivity
- DNS health
- outages and alerts
- local device activity
- reports and metrics
- room-based Wi-Fi sampling and Wi-Fi alerting
- traffic summaries and top talkers
- backend-powered incident investigations
- room-based Wi-Fi sampling, Wi-Fi alerting, and Wi-Fi room mapping
- traffic summaries, top talkers, recent samples, and traffic drawers
- capture export request metadata and history

The current product shape is:

- **Backend:** Rust, Axum, Tokio, SQLx, SQLite
- **Frontend:** React, TypeScript, Vite, TanStack Query, Tailwind
- **Interface:** local HTTP API + dashboard

## Current status

Lag Rat is in a late MVP / early productization stage.

Implemented:

- connectivity monitoring
- DNS monitoring
- outage tracking
- device inventory with history
- alert lifecycle and acknowledgment
- alert history API and timeline UI
- reports summary, trends, recent events, top incident targets, and snapshot export
- metrics summary and metrics page
- shared drawer shell and drawer detail sections
- backend integration coverage for major dashboard-facing APIs
- Wi-Fi sample ingest and persistence
- Wi-Fi signal alerting and stale-sample alerting
- Wi-Fi summaries, location summaries, and recent-sample workflows
- Wi-Fi page with room comparison, timelines, recoveries, and sample detail drawers
- traffic summary, top talker, and recent traffic sample workflows
- backend investigation read model for incident targets
- investigation drawer with related outages, alert events, devices, traffic, and Wi-Fi context
- Wi-Fi room mapping summary / coverage workflow
- traffic top talker and traffic sample detail drawers
- capture export request API
- capture export request actions from traffic drawers
- capture export request history on the Traffic page

## Current focus

- keeping documentation aligned with implemented platform workflows
- refining traffic observability and capture handoff workflows
- refining investigation entry points across dashboard surfaces
- preserving the collector/plugin boundary for future observability domains
- keeping Lag Rat summary-oriented rather than turning it into a packet-analysis suite
- defining a collector/plugin boundary for future observability domains
- refining investigation and traffic observability workflows as shared platform capabilities

## Platform model

Lag Rat should be treated as a small observability platform rather than only a network dashboard.

### Core platform

Shared platform responsibilities:

- collectors / module ingestion
- local storage
- incident state
- alerts and timelines
- report aggregation
- local API
- dashboard surfaces

### Current module

The current primary module is **home network observability**:

- router
- internet
- DNS
- devices
- outages
- alerts
- reports
- metrics
- Wi-Fi samples and room-level Wi-Fi health

### Near-term additions

- responsive/mobile dashboard polish
- traffic observability hardening
- investigation workflow refinement
- optional packet capture export hooks
- clearer collector/plugin boundaries for future modules

### Future modules

- Bitcoin node observability
- Lightning observability

## Packet capture boundary

Lag Rat records **capture export request metadata** as an operator handoff from traffic and investigation workflows.

Lag Rat should not inspect packet contents or become a Wireshark replacement. Packet-level analysis should remain external through tools such as `tcpdump` and Wireshark.

Current capture workflow:

```text

Traffic drawer
→ Create capture export request
→ Capture request history records source, target, window, status, and note
→ Operator uses external tools for packet-level inspection

```

## Current priorities

- finish responsive/mobile dashboard behavior
- tighten overview as the main operator dashboard
- keep technical detail in drawers while keeping list/table surfaces more human-friendly
- design the collector/plugin boundary for future modules
- continue docs and repo polish
- use Wi-Fi as the first deeper module-level workflow built on shared platform primitives

## Testing

Current strength:

- backend integration coverage for alerts, outages, overview, reports, metrics, and Wi-Fi endpoints
- frontend coverage for dashboard surfaces including Wi-Fi flows and drawer interactions

Next major testing step:

- expand HTTP/API coverage for remaining module-specific surfaces
- continue operator-path verification for Wi-Fi and future module additions

## Stack

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
- Vitest
- Testing Library

---

## Monorepo structure

```text

lag-rat/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── database-schema.md
│   ├── roadmap.md
│   ├── experiments.md
│   └── lag_rat.md
├── backend/
├── frontend/
└── scripts/

```
