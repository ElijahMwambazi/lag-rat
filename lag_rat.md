# Lag Rat

A home-network observability platform for monitoring connectivity, latency, packet loss, DNS health, and device activity on a local network.

**Lag Rat** uses a **Rust backend** for data collection, scheduling, storage, summaries, and API delivery, and a **React + TypeScript dashboard** for visualization and diagnostics.

---

## 1. Project Vision

The goal of Lag Rat is to turn a home router and local devices into a practical observability lab.

Instead of treating the network as a black box, this suite helps answer questions like:

- Is the router reachable?
- Is the internet actually up?
- Is DNS failing or just slow?
- How often does packet loss happen?
- When did outages occur?
- Which devices are active on the LAN?
- How does Wi-Fi quality vary by room, band, or time of day?

This project is both:

- a **useful monitoring tool**
- a **learning platform** for networking, systems programming, and frontend visualization

---

## 2. Core Objectives

- Monitor **router availability**
- Monitor **internet reachability**
- Measure **latency**, **jitter**, and **packet loss**
- Track **DNS success/failure and response times**
- Build a **time-series view** of network health
- Expose metrics through a local **API**
- Visualize data in a modern **dashboard**
- Create a foundation for future features like:
  - outage alerts
  - device inventory
  - Wi-Fi signal mapping
  - PCAP analysis
  - weekly reliability reports

---

## 3. High-Level Architecture

```text
[ Router / Internet / LAN Devices ]
                |
                v
        [ Rust Collector Service ]
                |
      +---------+----------+
      |                    |
      v                    v
[ SQLite / Timeseries ]   [ Local API ]
                                |
                                v
                   [ React + TypeScript Dashboard ]
```

### Main flow

1. The Rust backend performs scheduled checks against the router, public hosts, and DNS resolvers.
2. Results are stored locally for historical analysis.
3. The backend exposes a local API for the frontend.
4. The React dashboard displays current health and historical trends.
5. Future modules can add alerts, signal mapping, and packet analysis.

---

## 4. Final Tech Stack

### Backend
- **Rust**
- **Axum**
- **Tokio**
- **SQLx**
- **SQLite**
- **Serde**
- **Reqwest**
- **Tracing**
- **Tower HTTP**
- **Anyhow**
- **thiserror**

### Frontend
- **React**
- **TypeScript**
- **Vite**
- **React Router**
- **TanStack Query**
- **Recharts**
- **Tailwind CSS**
- **shadcn/ui**
- **date-fns**
- **Zod**

### Why this stack

#### Backend rationale
- **Axum** gives a clean, modern API architecture and fits naturally with Tokio.
- **Tokio** handles async scheduling, probes, and API serving well.
- **SQLx + SQLite** keeps the MVP lightweight while still giving strong control over schema and queries.
- **Reqwest** supports HTTP probes and future integrations.
- **Tracing** gives structured logs from the start, which is important for an observability project.

#### Frontend rationale
- **Vite** keeps the frontend fast and simple to develop.
- **React Router** supports a clean multi-page dashboard layout.
- **TanStack Query** is ideal for polling, caching, and keeping API state manageable.
- **Recharts** is a good fit for latency, DNS, outage, and uptime visualizations.
- **Tailwind + shadcn/ui** gives a fast, modern dashboard UI without much friction.

---

## 5. Proposed Feature Modules

## 5.1 Connectivity Monitor
Responsible for determining whether:

- the router is reachable
- the local gateway responds
- the wider internet responds

Possible checks:
- ping router IP
- ping public IP
- HTTP probe to a known endpoint

Outputs:
- online/offline state
- round-trip time
- packet loss percentage
- failure counts

---

## 5.2 DNS Health Monitor
Responsible for testing whether DNS is healthy.

Possible checks:
- resolve known domains
- time DNS lookups
- record NXDOMAIN / timeout / resolver failure events

Outputs:
- DNS response time
- lookup success rate
- resolver error counts

---

## 5.3 Time-Series Storage Layer
Responsible for persisting observations.

Suggested stored entities:
- health checks
- latency measurements
- DNS checks
- outage events
- device sightings
- system metadata

Possible schema groups:
- `connectivity_checks`
- `dns_checks`
- `outages`
- `devices`
- `settings`

---

## 5.4 Local API
The API serves the dashboard and possibly CLI clients.

Suggested endpoints:
- `GET /api/health/current`
- `GET /api/health/history`
- `GET /api/dns/history`
- `GET /api/outages`
- `GET /api/devices`
- `GET /api/stats/summary`

Possible response categories:
- current network state
- historical time windows
- uptime summaries
- DNS trends
- active device list

---

## 5.5 Dashboard
The dashboard presents network status clearly.

Suggested pages/components:
- **Overview**
  - current status
  - router reachability
  - internet reachability
  - DNS status
- **Latency**
  - recent RTT charts
  - packet loss chart
- **Outages**
  - outage log
  - downtime duration
- **Devices**
  - known devices
  - last seen timestamps
- **Reports**
  - daily/weekly summaries

Suggested UI widgets:
- status cards
- line charts
- outage timeline
- uptime percentage
- latest events panel

---

## 5.6 Device Inventory
Tracks devices present on the local network.

Possible methods:
- ARP table observation
- local subnet scanning
- passive discovery from traffic or checks

Tracked data:
- IP address
- MAC address
- hostname
- first seen
- last seen
- vendor lookup later

Note: keep all discovery limited to devices on your own network.

---

## 5.7 Alerting Module
Optional later module.

Possible alerts:
- router unreachable
- internet outage
- DNS failures exceed threshold
- packet loss spikes
- unusual downtime duration

Possible channels:
- local dashboard banner
- desktop notification
- webhook
- Telegram bot later

---

## 5.8 Wi-Fi Signal Mapping
Optional later module using an Android phone or laptop measurements.

Potential metrics:
- RSSI
- packet loss by room
- latency by location
- 2.4 GHz vs 5 GHz comparison

---

## 5.9 PCAP / Packet Analysis Integration
Optional later module.

Use case:
- import packet captures from Wireshark
- summarize top protocols
- correlate outages with observed traffic

This should be a separate analysis module, not part of the minimal first version.

---

## 6. Suggested Repository Structure

```text
lag-rat/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── database-schema.md
│   ├── roadmap.md
│   └── experiments.md
├── backend/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── config/
│       ├── api/
│       ├── db/
│       ├── monitors/
│       │   ├── connectivity/
│       │   ├── dns/
│       │   └── devices/
│       ├── services/
│       ├── models/
│       ├── scheduler/
│       └── utils/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── app/
│       ├── components/
│       ├── pages/
│       ├── features/
│       ├── services/
│       ├── hooks/
│       ├── types/
│       └── utils/
└── scripts/
```

---

## 7. Backend Responsibilities

The Rust backend should own:

- scheduling checks
- executing probes
- storing results
- computing summaries
- exposing API responses
- optionally raising alerts

### Suggested internal modules

#### `monitors/connectivity`
- ping checks
- HTTP reachability checks
- packet loss logic

#### `monitors/dns`
- domain resolution timing
- resolver comparison
- failure classification

#### `monitors/devices`
- ARP-based or scan-based discovery
- device last-seen updates

#### `scheduler`
- interval jobs
- retry rules
- timeout handling

#### `db`
- migrations
- repository queries
- aggregation queries

#### `api`
- REST endpoints
- DTOs / serializers
- request validation

---

## 8. Frontend Responsibilities

The React dashboard should own:

- current status presentation
- chart rendering
- filters by time range
- outage log browsing
- device table display
- summary cards and reports

### Suggested frontend sections

#### Overview page
- current health state
- uptime percentage
- latest latency
- latest DNS result
- recent incidents

#### Metrics page
- latency over time
- packet loss trends
- DNS timing trends

#### Devices page
- active devices
- historical sightings
- device metadata

#### Reports page
- daily summary
- weekly summary
- export-ready views later

---

## 9. Data Model Ideas

### Connectivity check
- timestamp
- target
- target_type
- success
- latency_ms
- packet_loss_pct
- error_message

### DNS check
- timestamp
- domain
- resolver
- success
- response_time_ms
- record_count
- error_message

### Outage
- started_at
- ended_at
- duration_ms
- outage_type
- notes

### Device
- ip_address
- mac_address
- hostname
- first_seen
- last_seen

---

## 10. MVP Scope

A good first version should stay small.

### MVP backend
- scheduled connectivity checks
- scheduled DNS checks
- SQLite storage
- simple REST API
- basic summary calculations

### MVP frontend
- overview page
- latency chart
- DNS chart
- outage log
- current status cards

### MVP exclusions
Do **not** include these in the first version:
- authentication
- cloud sync
- remote access
- packet capture import
- advanced device fingerprinting
- mobile app
- notification integrations

---

## 11. Development Milestones

## Milestone 1 — Project scaffolding
- create repo
- initialize Rust backend
- initialize React frontend
- define shared project conventions
- write base documentation

## Milestone 2 — Connectivity monitor
- add router/public target probes
- store results in SQLite
- expose current status endpoint

## Milestone 3 — DNS monitor
- perform timed lookups
- persist DNS metrics
- expose DNS history endpoint

## Milestone 4 — Dashboard foundation
- create overview page
- add status cards
- add historical charts
- add outage table

## Milestone 5 — Summaries and reports
- compute uptime percentage
- summarize outages
- add daily/weekly view

## Milestone 6 — Device inventory
- discover local devices
- show active device table

## Milestone 7 — Advanced observability
- alerts
- Wi-Fi mapping
- PCAP integration
- richer analytics

---

## 12. Non-Functional Goals

- lightweight enough to run on a normal laptop or small host
- easy to understand and extend
- clean separation between monitors, storage, and UI
- safe for home-lab use
- focused on observability, not intrusive scanning
- reproducible and documented

---

## 13. Local Development Plan

### Backend

```bash
cd backend
cargo run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Local setup goals
- backend runs on a local API port
- frontend reads from backend API
- SQLite file is created locally
- configuration stored in environment variables

---

## 14. Configuration Ideas

Potential configuration values:
- router IP
- probe interval
- DNS test domains
- DNS resolver address
- packet timeout
- API port
- database path

Example categories:
- network targets
- scheduler intervals
- storage settings
- UI API base URL

---

## 15. Roadmap Ideas

After MVP, possible next steps:

- export reports as JSON/CSV
- Telegram or email alerts
- per-device history
- ISP performance comparison by time of day
- Wi-Fi room-by-room testing workflow
- packet capture ingestion
- Prometheus-compatible metrics
- Docker support
- dark mode dashboard polish
- mobile-friendly dashboard layout

---

## 16. Learning Goals

This project can teach:

- Rust async backend architecture
- time-series data modeling
- network diagnostics
- DNS behavior and failure modes
- API design
- React dashboard design
- charting and visualization
- practical home-lab observability

---

## 17. Safety and Scope Notes

This suite is intended for:
- your own router
- your own devices
- your own LAN
- defensive monitoring and diagnostics

Do not use the discovery or scanning components on networks you do not own or explicitly control.

---

## 18. Initial Build Order Recommendation

Recommended implementation order:

1. repo scaffolding
2. Rust connectivity monitor
3. SQLite storage
4. REST API
5. React dashboard overview
6. DNS monitor
7. outage summaries
8. device inventory
9. alerting
10. advanced analytics

---

## 19. Naming Notes

**Lag Rat** is intentionally playful:
- memorable
- network-themed
- slightly chaotic in a good way
- distinctive enough for a portfolio project

Suggested package/repo naming:
- repo: `lag-rat`
- backend crate: `lag-rat-backend` or `lagratd`
- frontend app: `lag-rat-dashboard`

---

## 20. License

Choose a license depending on your goals:

- **MIT** for simplicity
- **Apache-2.0** for explicit patent grant
- **GPL-3.0** if you want stronger copyleft

---

## 21. Next Steps

Immediate next steps:

- scaffold backend with Axum + Tokio
- scaffold frontend with Vite + React + TypeScript
- define MVP endpoints
- write initial database schema
- add first connectivity probe
- add first dashboard overview page

---

## 22. Status

Planning / design phase.
