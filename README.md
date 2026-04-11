# Lag Rat

Lag Rat is a local home-network observability platform built with a Rust backend and a React + TypeScript dashboard.

It monitors:

- router reachability
- internet connectivity
- DNS health
- outages and recoveries
- alerts and alert history
- local device activity and device history

The project is intended for practical home-lab diagnostics and as a learning platform for observability, networking, Rust backend design, and frontend dashboard workflows.

---

## Current status

Lag Rat is in a late MVP / early productization stage.

Implemented:

- connectivity monitoring
- DNS monitoring
- outage tracking
- device inventory with history
- alert lifecycle with debounce and severity escalation
- alert acknowledgment workflow
- alert history API and timeline UI
- reports summary endpoint and page
- reports trend endpoint and charts
- metrics summary endpoint and metrics page
- recent alert/device report panels
- top incident targets
- reports snapshot export
- shared drawer shell
- shared drawer detail section component
- humanized alert/outage/report copy on main surfaces
- backend integration coverage for alerts, outages, overview, and reports/metrics APIs

Current focus:

- dashboard cohesion
- final UI consistency
- operator-friendly wording
- state handling polish
- docs refresh

---

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
- shadcn/ui
- date-fns
- Zod

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

---

## Getting started

### Backend

```bash
cd backend
cp .env.example .env
cargo run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Current priorities

- finish metrics page consistency/state handling
- tighten overview as the main operator dashboard
- keep technical detail in drawers while keeping list/table surfaces more human-friendly
- continue docs and repo polish

---

## Scope notes

Lag Rat is intended for:

- your own router
- your own LAN
- your own devices
- defensive diagnostics and observability

Do not use discovery or scanning features on networks you do not own or explicitly control.
