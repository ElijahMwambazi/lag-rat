#!/usr/bin/env bash
set -euo pipefail

echo "Starting backend and frontend dev servers..."
(
  cd backend
  cargo run
) &
(
  cd frontend
  npm run dev
) &
wait
