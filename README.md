# Lag Rat

A home-network observability suite built with a **Rust backend** and a **React + TypeScript dashboard**.

## Current MVP status
- SQLite schema is applied through tracked SQL migration files
- Connectivity probe persists router and internet checks
- DNS probe persists lookup checks
- Outages are tracked as first-class records
- Device inventory runs cross-platform
- Status overview endpoint aggregates current network state
- React dashboard shows current issues, devices, outages, and summaries

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
