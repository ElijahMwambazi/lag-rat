# Roadmap

## Purpose

This document tracks the implementation sequence and current priorities for Lag Rat.

Lag Rat should be treated as a **local observability platform** with a current primary focus on **home network observability**.

---

## Milestone 1 — Foundation

Completed:

- scaffold repo
- working Axum backend
- working Vite dashboard
- SQLite persistence
- local API foundation

---

## Milestone 2 — Core Monitoring

Completed:

- connectivity monitoring
- DNS monitoring
- current health/status APIs
- historical health and DNS APIs
- outage lifecycle tracking

---

## Milestone 3 — Device and Alerting Layer

Completed:

- device inventory
- device history
- known device labeling
- alert lifecycle
- alert acknowledgment
- alert history API
- alert detail drawer and timeline

---

## Milestone 4 — Reports and Metrics

Completed:

- reports summary endpoint
- reports trends endpoint
- metrics summary endpoint
- recent report alert events
- recent report device events
- top incident targets
- reports snapshot export
- reports page
- metrics page time-window controls
- metrics summary strip

---

## Milestone 5 — UI Consolidation

Completed:

- shared `SideDrawer` shell
- shared `DrawerDetailSection`
- aligned alert, device, outage, and Wi-Fi drawers around shared patterns
- improved timeline styling consistency
- reports outage explorer aligned to selected window
- humanized alert / outage / recent alert event wording on primary surfaces
- collapsible dense-data sections for Wi-Fi and reports workflows

---

## Milestone 6 — Backend Confidence

Completed:

- integration coverage for alerts
- integration coverage for outages
- integration coverage for status overview
- integration coverage for reports and metrics endpoints
- integration coverage for Wi-Fi samples, latest sample, summaries, locations, and alert transitions

---

## Milestone 7 — Wi-Fi Module Hardening

Completed:

- Wi-Fi sample migration and persistence
- collector ingest for Wi-Fi observations
- weak-signal alert evaluation
- stale-sample alert evaluation
- Wi-Fi summary and per-location summary endpoints
- Wi-Fi page with room comparison, timelines, recoveries, and sample detail drawers
- Wi-Fi frontend and backend test coverage for main operator flows

---

## Milestone 8 — Investigation and Traffic Read Models

Completed:

- backend investigation read model for incident targets
- investigation payload with related outages, recent alert events, likely devices, traffic context, Wi-Fi context, and operator summary fields
- investigation drawer wired to backend investigation payload
- investigation query-param flow from Reports
- traffic summary endpoint
- traffic top-talkers endpoint
- traffic recent-samples endpoint
- frontend traffic API client types
- traffic top talker detail drawer
- traffic sample detail drawer
- traffic query-param drawer flows

---

## Milestone 9 — Dashboard Productization

Completed:

- responsive/mobile dashboard polish
- overview page cohesion
- final dashboard wording consistency
- empty / loading / partial-failure UX polish
- shared page filter and drawer interaction patterns
- cross-page drill-in flows
- docs refresh to match implementation
- collector/plugin boundary definition for future modules

---

## Milestone 10 — Capture Export Handoff

Completed:

- backend capture export request API
- capture export request persistence
- capture export request listing
- frontend capture export actions from traffic top talker drawers
- frontend capture export actions from traffic sample drawers
- capture export request history on the Traffic page
- packet-capture boundary documented as metadata handoff, not packet inspection
- guarded local capture execution through allowlisted `tcpdump` commands, disabled by default
- capture request deletion with guarded local `.pcap` cleanup
- capture request detail drawer with `captureRequestId` deep links
- capture history status chips, filters, clear-filters action, and compact table mode
- stale running capture request recovery

---

## Milestone 11 — Current Work

In progress:

- investigation workflow refinement across Reports, Overview, and Alerts
- capture export workflow refinement
- capture troubleshooting examples
- documentation alignment as implemented capabilities move forward

Completed:

- capture execution readiness endpoint and Traffic page indicator
- capture troubleshooting guide

---

## Milestone 12 — Later Enhancements

Not started:

- richer room-by-room performance workflows
- ISP comparison by time of day
- Prometheus-compatible metrics export
- Docker packaging
- packet capture / PCAP analysis
- packet capture / PCAP analysis outside Lag Rat
- remote access / cloud sync
- richer notification channels
- Bitcoin node observability module
- Lightning observability module

---

## Platform shaping

- define collector/plugin boundary
- keep current network monitoring as the first module
- make future module expansion possible without rewriting core platform abstractions
- use Wi-Fi as the reference pattern for future module-specific surfaces built on shared primitives

## Near-term new capabilities

- capture export workflow refinement
- capture troubleshooting and stale-running recovery
- investigation entry points from Overview and Alerts
- future module onboarding patterns

## Future modules

- Bitcoin node observability module
- Lightning observability module
