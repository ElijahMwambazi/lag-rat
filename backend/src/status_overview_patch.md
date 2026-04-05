Update your `backend/src/services/status_overview.rs` so it builds four connectivity views:

- `router` from `router_tcp`
- `internet_tcp` from `internet_tcp`
- `internet_http` from `internet_http`
- `internet` summary derived from TCP + HTTP

Pseudo-logic:

```rust
internet.is_healthy = internet_tcp.is_healthy && internet_http.is_healthy;
internet.active_outage = internet_tcp.active_outage || internet_http.active_outage;
internet.latest_error_message = internet_http.latest_error_message.or(internet_tcp.latest_error_message);
```
