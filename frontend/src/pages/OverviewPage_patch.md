Update your Overview page to render these extra fields from `/api/status/overview`:

- `internet_tcp`
- `internet_http`

Recommended top cards:
- Router
- Internet
- Internet TCP
- Internet HTTP
- DNS

Recommended hint on Internet summary card:
```tsx
HTTP {overview.internet_http.is_healthy ? "ok" : "fail"} · TCP {overview.internet_tcp.is_healthy ? "ok" : "fail"}
```
