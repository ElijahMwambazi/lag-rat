# Lag Rat

A home-network observability suite built with a **Rust backend** and a **React + TypeScript dashboard**.

## Current MVP status
- SQLite schema bootstraps through SQL migration files
- Connectivity probe persists router and internet checks
- DNS probe persists lookup checks
- Outages are tracked as first-class records
- Device inventory performs a first LAN pass from the local ARP table
- Local REST API reads real data from SQLite
- React dashboard consumes the real API

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
