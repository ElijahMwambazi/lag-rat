# Database Schema Draft

## connectivity_checks
- id
- timestamp
- target
- target_type
- success
- latency_ms
- packet_loss_pct
- error_message

## dns_checks
- id
- timestamp
- domain
- resolver
- success
- response_time_ms
- error_message

## outages
- id
- outage_type
- target
- started_at
- ended_at
- is_active
- start_error
- end_note

## devices
- id
- ip_address
- mac_address
- hostname
- first_seen
- last_seen
