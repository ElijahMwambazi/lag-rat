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
- aligned alert, device, and outage drawers around shared patterns
- improved timeline styling consistency
- reports outage explorer aligned to selected window
- humanized alert / outage / recent alert event wording on primary surfaces

---

## Milestone 6 — Backend Confidence

Completed:

- integration coverage for alerts
- integration coverage for outages
- integration coverage for status overview
- integration coverage for reports and metrics endpoints

---

## Milestone 7 — Current Work

In progress:

- responsive/mobile dashboard polish
- metrics page consistency and state handling
- overview page cohesion
- final dashboard wording consistency
- empty / loading / partial-failure UX polish
- docs refresh to match implementation
- define collector/plugin boundary for future modules

---

## Milestone 8 — Near-Term Next Work

Planned:

- frontend component/state coverage for reports and metrics surfaces
- screenshot refresh for docs / repo presentation
- first room-based Wi-Fi sampling workflow
- initial traffic summaries / top talkers direction
- optional packet capture export hook design

---

## Milestone 9 — Later Enhancements

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

## Near-term new capabilities

- room-based Wi-Fi sampling
- richer traffic summaries / top talkers
- optional packet capture export hooks

## Future modules

- Bitcoin node observability module
- Lightning observability module

---

## Maintenance notes

When updating this file:

- move items forward only when they become active build priorities
- keep completed work specific and factual
- keep exploratory ideas in `experiments.md`, not here
- treat near-term additions as likely implementation work, not completed capability
- prefer appending to the current milestone structure instead of redesigning it
