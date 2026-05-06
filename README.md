# Lag Rat

Lag Rat is a **local observability platform** with a current primary focus on **home network observability**.

Today, the first implemented module is network monitoring for:

- router reachability
- internet connectivity
- DNS health
- outages and alerts
- local device activity
- reports and metrics
- room-based Wi-Fi sampling, Wi-Fi alerting, and Wi-Fi room mapping
- traffic summaries, top talkers, recent samples, and traffic drawers
- backend-powered incident investigations
- capture export request metadata, history, lifecycle controls, and guarded local cleanup

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
- Wi-Fi room mapping summary / coverage workflow
- traffic summary, top talker, and recent traffic sample workflows
- traffic top talker and traffic sample detail drawers
- backend investigation read model for incident targets
- investigation drawer with related outages, alert events, devices, traffic, and Wi-Fi context
- capture export request API
- capture export request actions from traffic drawers
- capture export request lifecycle state and Traffic page history
- guarded local capture execution through allowlisted `tcpdump` commands, disabled by default
- capture request deletion with guarded local `.pcap` cleanup

## Current focus

- refining investigation entry points across Overview, Alerts, and Reports
- refining capture export workflow visibility, lifecycle state, and operator handoff actions
- documenting local capture execution requirements, cleanup behavior, and safe operating boundaries
- preserving the collector/plugin boundary for future observability domains

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
- Wi-Fi samples, room-level Wi-Fi health, and Wi-Fi room mapping
- traffic summaries, top talkers, samples, and capture export handoffs
- incident investigations
- guarded local capture execution through allowlisted `tcpdump` commands, disabled by default
- guarded local capture cleanup for request metadata and matching `.pcap` files

### Near-term additions

- traffic observability hardening
- investigation workflow refinement
- clearer collector/plugin boundaries for future modules
- capture history/detail UX polish

### Future modules

- Bitcoin node observability
- Lightning observability

## Packet capture boundary

Lag Rat records **capture export request metadata** as an operator handoff from traffic and investigation workflows.

Lag Rat can optionally execute short, local, allowlisted `tcpdump` captures when explicitly enabled. It still does **not** inspect packet contents or become a Wireshark replacement. Packet-level analysis should remain external through tools such as `tcpdump` and Wireshark.

Current capture workflow:

```text
Traffic drawer
→ create capture export request
→ request appears in capture history
→ operator queues or cancels the request
→ capture worker runs preflight checks when execution is enabled
→ guarded tcpdump runner writes a local .pcap file when permitted
→ request is marked completed or failed
→ operator inspects packet contents externally
→ operator can delete request metadata and safely remove matching local .pcap files
```

Capture files are local sensitive artifacts. Lag Rat can delete capture request metadata and safely remove matching local `.pcap` files, but it does not parse packet contents or act as a Wireshark replacement.

## Current priorities

- tighten overview as the main operator dashboard
- keep technical detail in drawers while keeping list/table surfaces more human-friendly
- refine investigation and capture handoff entry points
- document local capture execution and cleanup behavior clearly
- design the collector/plugin boundary for future modules
- continue docs and repo polish

## Testing

Current strength:

- backend integration coverage for alerts, outages, overview, reports, metrics, Wi-Fi, traffic, and capture endpoints
- frontend coverage for dashboard surfaces including Wi-Fi flows, traffic flows, capture lifecycle actions, and drawer interactions

Next major testing step:

- continue operator-path verification for capture history/detail workflows
- expand HTTP/API coverage for remaining module-specific surfaces
- continue operator-path verification for future module additions

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
│   ├── capture-execution-plan.md
│   ├── collector-plugin-boundary.md
│   ├── database-schema.md
│   ├── docs-index.md
│   ├── experiments.md
│   ├── lag-rat.md
│   └── roadmap.md
├── backend/
├── frontend/
└── scripts/
```
