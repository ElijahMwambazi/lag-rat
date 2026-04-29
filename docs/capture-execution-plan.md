# Capture Execution Plan

## Purpose

This document defines the planned boundary for future packet-capture execution in Lag Rat.

Lag Rat already supports capture export request metadata. That means the operator can create a capture handoff from traffic workflows and review request history.

This document covers the next step: how Lag Rat may eventually execute a bounded packet capture safely.

---

## Current status

Implemented:

- capture export request API
- capture export request persistence
- capture export request history
- capture export actions from traffic drawers
- metadata handoff boundary

Not implemented:

- packet capture execution
- packet capture command runner
- PCAP file generation
- packet-content parsing
- packet-content analysis inside Lag Rat

---

## Core boundary

Lag Rat may become a capture handoff and execution coordinator.

Lag Rat should not become a packet-analysis suite.

Allowed direction:

```text
Traffic / investigation context
→ create capture request
→ optionally queue bounded capture execution
→ write capture file locally
→ expose file/reference metadata
→ inspect externally with tcpdump or Wireshark
```

Not allowed direction:

```text
arbitrary command execution
unbounded packet capture
packet content inspection inside Lag Rat
cloud upload / remote sync by default
Wireshark replacement UI
```

---

## Execution principles

Packet capture execution must be:

- local-only
- explicitly requested by the operator
- short-lived
- interface-scoped
- command-allowlisted
- stored in a predictable local directory
- visible through request status
- safe to fail without affecting monitoring
- optional and disabled unless configured

---

## Proposed request lifecycle

Current state:

```text
requested
```

Future states:

```text
requested
→ queued
→ running
→ completed
```

Failure or cancellation paths:

```text
requested
→ queued
→ failed

running
→ failed

running
→ cancelled
```

Suggested status meanings:

- `requested`: metadata record was created by the dashboard or API
- `queued`: capture worker accepted the request
- `running`: capture process is active
- `completed`: capture file/reference is available
- `failed`: capture process could not complete
- `cancelled`: operator or system stopped execution early

---

## Command allowlist

Lag Rat must not accept arbitrary shell commands.

Allowed command templates should be defined internally by the backend.

Potential v1 command shape:

```text
tcpdump -i <interface> -w <output_file> -G <duration_seconds> -W 1
```

Optional host-scoped form:

```text
tcpdump -i <interface> host <ip_address> -w <output_file> -G <duration_seconds> -W 1
```

The operator may choose from safe parameters only:

- interface
- duration
- optional host filter
- request note

The operator must not provide:

- raw shell snippets
- arbitrary tcpdump expressions
- output path
- command flags
- post-processing commands

---

## Duration limits

Recommended v1 limits:

- default duration: 30 seconds
- maximum duration: 120 seconds
- minimum duration: 5 seconds

Longer captures should remain outside Lag Rat.

---

## Interface scope

Capture execution should require an explicit interface.

Allowed:

```text
eth0
wlan0
enp3s0
wlp2s0
```

Not allowed by default:

```text
any
all interfaces
unknown interface
```

The backend should validate the requested interface against known traffic samples or a configured allowlist.

---

## Host filter scope

A host filter may be derived from:

- `device_ip_address`
- `entity_key`
- investigation target when it is a valid local IP

The backend should reject host filters that are empty, malformed, or not relevant to the local network context.

---

## Storage path

Capture files should be written to a fixed local directory.

Recommended default:

```text
data/captures/
```

Filename shape:

```text
capture-<request_id>-<timestamp>.pcap
```

The API should expose only metadata/reference fields, not arbitrary file paths.

---

## Retention policy

Capture files can contain sensitive network data.

Recommended v1 retention:

- keep capture files for 24 hours by default
- allow manual deletion later
- expose file size and created time
- do not upload files anywhere
- do not sync files to cloud storage

Future retention configuration:

```text
CAPTURE_RETENTION_HOURS=24
CAPTURE_MAX_FILE_MB=50
```

---

## Permissions model

Packet capture often requires elevated privileges.

Recommended development approach:

- document required OS permissions clearly
- prefer running only the capture helper with required privileges
- do not require the entire dashboard/API to run as root
- fail safely when permissions are missing

Possible Linux approaches:

```text
setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump
```

or a tightly controlled helper process.

This needs careful review before implementation.

---

## API evolution

Current endpoint:

```text
POST /api/captures/export-requests
GET /api/captures/export-requests?limit=20
```

Future execution endpoints may include:

```text
POST /api/captures/export-requests/{id}/queue
POST /api/captures/export-requests/{id}/cancel
GET /api/captures/export-requests/{id}
```

Do not add execution endpoints until command allowlists, file retention, and permission behavior are finalized.

---

## Database evolution

Current table:

```text
capture_export_requests
```

Possible future fields:

- `queued_at`
- `started_at`
- `completed_at`
- `failed_at`
- `cancelled_at`
- `failure_reason`
- `duration_seconds`
- `output_filename`
- `file_size_bytes`

Avoid storing packet contents in SQLite.

---

## Worker model

Capture execution should not block normal API handling.

Recommended future model:

```text
API request
→ mark capture request as queued
→ background worker starts bounded tcpdump process
→ worker updates status
→ dashboard polls request history
```

The worker should be isolated from regular monitoring loops.

---

## Failure modes

The capture worker should handle:

- missing `tcpdump`
- permission denied
- invalid interface
- invalid host filter
- process timeout
- output directory unavailable
- output file too large
- process exited with non-zero status

Failures should update the request status to `failed` with a short operator-readable reason.

---

## Dashboard behavior

The dashboard should show:

- requested captures
- queued captures
- running captures
- completed captures
- failed captures
- capture references when available

The dashboard should not parse packets.

Completed captures should be presented as handoff artifacts for external tools.

---

## Security and privacy notes

Capture files can contain sensitive metadata and payloads.

Lag Rat should treat capture execution as a privileged local operation.

Guardrails:

- no remote upload by default
- no cloud sync by default
- no packet content rendering in the dashboard
- no arbitrary shell execution
- short durations only
- local file retention policy
- explicit operator action required

---

## Implementation order

Recommended order:

1. document command allowlist and retention behavior
2. add status transition fields
3. add backend status update helpers
4. add queue/cancel API shape
5. add worker skeleton without executing tcpdump
6. add test coverage for state transitions
7. add guarded tcpdump execution
8. add dashboard status display
9. add manual deletion / cleanup workflow
