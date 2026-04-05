#!/usr/bin/env bash
set -euo pipefail
(
  cd backend
  cargo run
) &
(
  cd frontend
  npm run dev
) &
wait
