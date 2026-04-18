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

## Milestone 8 — Current Work

In progress:

- responsive/mobile dashboard polish
- overview page cohesion
- final dashboard wording consistency
- empty / loading / partial-failure UX polish
- docs refresh to match implementation
- define collector/plugin boundary for future modules

---

## Milestone 9 — Near-Term Next Work

Planned:

- traffic summaries / top talkers
- optional packet capture export hook design
- screenshot refresh for docs / repo presentation
- cleanup of collector/plugin boundaries now that Wi-Fi is implemented
- continued module-level productization and operator-path refinement

---

## Milestone 10 — Later Enhancements

Not started:

- Wi-Fi signal mapping
- richer room-by-room performance workflows
- ISP comparison by time of day
- Prometheus-compatible metrics export
- Docker packaging
- packet capture / PCAP analysis
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

- richer traffic summaries / top talkers
- optional packet capture export hooks
- future module onboarding patterns

## Future modules

- Bitcoin node observability module
- Lightning observability module
