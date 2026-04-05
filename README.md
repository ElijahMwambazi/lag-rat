# Lag Rat

A home-network observability suite built with a Rust backend and a React + TypeScript dashboard.

## Included

- tracked SQLite migrations
- first-class outages
- cross-platform device discovery
- status overview endpoint
- alert generation and `/api/alerts`
- known device labels and enriched `/api/devices`
- dashboard alerts panel
- backend tests for alerting and device enrichment
- frontend debug states for:
  - loading
  - request failures
  - empty data
  - API connectivity summary

## Run

```bash
cd backend
cp .env.example .env
cargo run
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```
