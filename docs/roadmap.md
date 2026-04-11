# Roadmap

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
- metrics page consistency and state handling
- overview page cohesion
- final dashboard wording consistency
- empty / loading / partial-failure UX polish
- docs refresh to match implementation

---

## Milestone 8 — Near-Term Next Work
Planned:
- final overview pass as the main operator dashboard
- frontend test coverage for reports/metrics surfaces
- additional copy cleanup on remaining raw technical text
- screenshot refresh for docs / repo presentation

---

## Milestone 9 — Later Enhancements
Not started:
- Wi-Fi signal mapping
- room-by-room performance workflows
- ISP comparison by time of day
- Prometheus-compatible metrics export
- Docker packaging
- packet capture / PCAP analysis
- mobile-friendly dashboard polish
- remote access / cloud sync
- richer notification channels
