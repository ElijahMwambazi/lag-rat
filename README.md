# Lag Rat

Lag Rat is a **local observability platform** with a current primary focus on **home network observability**.

Today, the first implemented module is network monitoring for:

- router reachability
- internet connectivity
- DNS health
- outages and alerts
- local device activity
- Wi-Fi room sampling
- traffic summaries and top talkers
- guarded local capture handoff workflows
- reports and metrics

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
- room-based Wi-Fi sampling, summaries, alerts, and dashboard flows
- traffic summary, top talkers, recent samples, and traffic detail drawers
- investigation workflows across reports, overview, and alerts
- capture export request lifecycle, queueing, cancellation, deletion, and history
- guarded local `tcpdump` execution with readiness checks and allowlisted interfaces
- device-scoped capture requests using backend-generated safe IP/MAC filters
- completed capture file guidance and copy-path workflow
- shared drawer shell and drawer detail sections
- backend integration coverage for major dashboard-facing APIs
- frontend coverage for main dashboard and capture workflows

## Current focus

- keep docs aligned with implemented Wi-Fi, traffic, investigation, and capture workflows
- polish capture output usability after real `.pcap` workflow testing
- continue dashboard cohesion and operator-friendly wording
- keep future module onboarding consistent with the collector/plugin boundary

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
- Wi-Fi
- traffic
- capture handoff
- outages
- alerts
- reports
- metrics

### Near-term additions

- capture output usability follow-ups
- dashboard polish after capture workflow testing
- future module onboarding patterns

### Future modules

- Bitcoin node observability
- Lightning observability

## Current priorities

- keep README and docs aligned with the current implementation
- keep technical detail in drawers while keeping list/table surfaces more human-friendly
- validate capture workflows on real local network setups
- keep packet analysis outside Lag Rat while improving capture handoff clarity
- continue repo polish and future module planning

## Testing

Current strength:

- backend integration coverage for alerts, outages, overview, reports, metrics, Wi-Fi, traffic, investigation, and capture endpoints
- frontend coverage for major dashboard, drawer, filter, and capture workflows

Next major testing step:

- expand coverage around future module onboarding patterns and any new capture output usability follow-ups

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
│   ├── capture-troubleshooting.md
│   ├── collector-plugin-boundary.md
│   ├── database-schema.md
│   ├── docs-index.md
│   ├── experiments.md
│   ├── roadmap.md
│   └── lag-rat.md
├── backend/
├── frontend/
└── scripts/
```
