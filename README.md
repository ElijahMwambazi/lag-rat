# Lag Rat

This patch adds:

- `internet_tcp` probe
- `internet_http` probe
- `router_tcp` probe classification
- separate overview fields for `internet_tcp` and `internet_http`
- separate metrics endpoint for TCP history
- updated frontend overview and metrics pages

## Apply in this order

1. Add `backend/migrations/0004_multi_probe.sql`
2. Update `backend/.env` and `.env.example`
3. Replace the files in `backend/src/` included here
4. Replace the files in `frontend/src/` included here
5. Run:

```bash
cd backend
cargo check
cargo run
```

Then in another terminal:

```bash
cd frontend
npm run dev
```

## New env values

```env
DNS_TEST_DOMAIN=google.com
DNS_RESOLVER=1.1.1.1
PUBLIC_PROBE_URL=https://www.google.com/generate_204
INTERNET_TCP_HOST=1.1.1.1
INTERNET_TCP_PORT=443
```
