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
