# Capture Execution Plan

## Purpose

This document defines the packet-capture execution boundary for Lag Rat.

Lag Rat supports capture export request metadata, request lifecycle state, guarded local `tcpdump` execution, capture history, retention cleanup, and manual deletion of capture request records.

Lag Rat should remain a capture handoff and execution coordinator. It should not become a packet-analysis suite.

---

## Current status

Implemented:

- capture export request API
- capture export request persistence
- capture export request history
- capture export actions from traffic drawers
- metadata handoff boundary
- capture lifecycle states
- queue and cancel transitions
- capture command allowlist builder
- capture output directory preparation
- capture file retention cleanup
- capture execution preflight checks
- guarded `tcpdump` runner
- capture request deletion
- guarded local `.pcap` cleanup
- dashboard confirmation before deleting capture requests
- capture detail drawer and `captureRequestId` deep links
- capture history status chips, filters, clear filters action, and compact table mode
- stale running capture request recovery

Not implemented:

- packet-content parsing
- packet-content analysis inside Lag Rat
- Wireshark-style packet inspection UI
- cloud upload / remote sync of captures

---

## Core boundary

Allowed direction:

```text
Traffic / investigation context
→ create capture request
→ optionally queue bounded capture execution
→ write capture file locally
→ expose file/reference metadata
→ inspect externally with tcpdump or Wireshark
→ delete request metadata and matching local capture file when no longer needed
```

Not allowed direction:

```text
arbitrary command execution
unbounded packet capture
packet content inspection inside Lag Rat
cloud upload / remote sync by default
Wireshark replacement UI
arbitrary file deletion
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

## Runtime configuration

Capture execution is disabled by default.

```env
CAPTURE_WORKER_INTERVAL_SECONDS=10
CAPTURE_EXECUTION_ENABLED=false
CAPTURE_OUTPUT_DIR=data/captures
CAPTURE_RETENTION_HOURS=24
CAPTURE_MAX_FILE_MB=50
CAPTURE_DEFAULT_DURATION_SECONDS=30
CAPTURE_MIN_DURATION_SECONDS=5
CAPTURE_MAX_DURATION_SECONDS=120
CAPTURE_ALLOWED_INTERFACES=
```

To enable guarded local execution:

```env
CAPTURE_EXECUTION_ENABLED=true
```

`CAPTURE_ALLOWED_INTERFACES` may be left empty during development, but a daily-use setup should prefer an explicit comma-separated allowlist:

```env
CAPTURE_ALLOWED_INTERFACES=eth0,wlan0,wlp2s0
```

Lag Rat only builds capture commands from internal templates. It does not accept arbitrary shell commands, arbitrary `tcpdump` expressions, custom output paths, or post-processing commands.

---

## Request lifecycle

Current lifecycle states:

```text
requested
→ queued
→ running
→ completed
```

Failure or cancellation paths:

```text
requested
→ cancelled

requested
→ queued
→ cancelled

requested
→ queued
→ running
→ failed

requested
→ queued
→ running
→ cancelled
```

Status meanings:

- `requested`: metadata record was created by the dashboard or API
- `queued`: capture worker can pick up the request
- `running`: capture process is active or the worker is processing the request
- `completed`: capture file/reference metadata is available
- `failed`: capture process could not complete
- `cancelled`: operator or system stopped execution early

---

## Command allowlist

Lag Rat must not accept arbitrary shell commands.

Allowed command templates are defined internally by the backend.

Base command shape:

```text
tcpdump -i <interface> -w <output_file> -G <duration_seconds> -W 1
```

Host-scoped command shape:

```text
tcpdump -i <interface> host <ip_address> -w <output_file> -G <duration_seconds> -W 1
```

The guarded runner uses argument vectors, not shell strings.

Example generated command:

```text
tcpdump -i eth0 -w data/captures/capture-12-20260429T123000Z.pcap -G 30 -W 1
```

Example generated host-scoped command:

```text
tcpdump -i eth0 host 192.168.1.20 -w data/captures/capture-12-20260429T123000Z.pcap -G 30 -W 1
```

The operator may choose from safe parameters only:

- interface
- duration
- optional host filter
- request note

The operator must not provide:

- raw shell snippets
- arbitrary `tcpdump` expressions
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

Common valid interface examples:

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

The backend validates requested interfaces against the configured allowlist when `CAPTURE_ALLOWED_INTERFACES` is set.

---

## Host filter scope

A host filter may be derived from:

- `device_ip_address`
- `entity_key`
- investigation target when it is a valid local IP

The backend rejects host filters that are empty, malformed, or not valid IP addresses.

---

## Storage path

Capture files are written to a fixed local directory.

Recommended default:

```text
data/captures/
```

Filename shape:

```text
capture-<request_id>-<timestamp>.pcap
```

The API exposes metadata/reference fields, not arbitrary file paths.

---

## Retention policy

Capture files can contain sensitive network data.

Recommended v1 retention:

- keep capture files for 24 hours by default
- expose file size and created time when available
- remove expired Lag Rat `.pcap` files from the configured capture directory
- do not upload files anywhere
- do not sync files to cloud storage

Retention configuration:

```env
CAPTURE_RETENTION_HOURS=24
CAPTURE_MAX_FILE_MB=50
```

A retention value of `0` disables automatic cleanup.

---

## Manual cleanup

Capture export requests can be deleted from the API and dashboard.

Endpoint:

```text
DELETE /api/captures/export-requests/{id}
```

Deletion behavior:

- running capture requests cannot be deleted
- the capture export request metadata is removed from SQLite
- if the request has a valid local capture reference, Lag Rat attempts to remove the referenced `.pcap` file
- file deletion is limited to Lag Rat capture files inside `CAPTURE_OUTPUT_DIR`
- Lag Rat does not delete arbitrary paths or files outside the configured capture directory
- Lag Rat does not inspect packet contents before deletion

The delete response reports whether metadata was deleted and whether a local capture file was deleted:

```json
{
  "id": 12,
  "deleted": true,
  "file_deleted": true
}
```

If no capture file exists or no capture reference is available, `file_deleted` is `false`.

---

## Permissions model

Packet capture often requires elevated privileges.

Recommended local development option:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip "$(command -v tcpdump)"
```

Check capabilities:

```bash
getcap "$(command -v tcpdump)"
```

If capabilities are not configured, capture requests may fail with a permission-related `tcpdump` error.

Lag Rat should not require the entire API/dashboard process to run as root. Prefer granting capture capability to the `tcpdump` binary or using a tightly controlled helper in the future.

---

## API surface

Current capture endpoints:

```text
POST   /api/captures/export-requests
GET    /api/captures/export-requests?limit=20
GET    /api/captures/export-requests/{id}
POST   /api/captures/export-requests/{id}/queue
POST   /api/captures/export-requests/{id}/cancel
DELETE /api/captures/export-requests/{id}
```

---

## Database model

Current capture table:

```text
capture_export_requests
```

Lifecycle and metadata fields include:

- `status`
- `queued_at`
- `started_at`
- `completed_at`
- `failed_at`
- `cancelled_at`
- `failure_reason`
- `duration_seconds`
- `output_filename`
- `capture_reference`
- `file_size_bytes`

Avoid storing packet contents in SQLite.

---

## Worker model

Capture execution should not block normal API handling.

Current worker model:

```text
queued request
→ mark as running
→ run preflight checks
→ build allowlisted command
→ prepare output directory
→ run guarded tcpdump command
→ mark completed or failed
→ dashboard polls request history
```

The worker remains isolated from regular monitoring loops. Failure to run a capture should not stop connectivity, DNS, Wi-Fi, traffic, reports, or alert monitoring.
Before processing queued work, the capture worker also checks for stale `running` requests. A running request is considered stale when its `started_at` timestamp is older than the configured maximum capture duration plus a recovery buffer.

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
- stale running request after backend restart or interrupted worker lifecycle

Failures should update the request status to `failed` with a short operator-readable reason.

---

## Stale running recovery

Capture requests may become stuck in `running` if the backend restarts, the worker is interrupted, or the process fails after marking a request as running but before recording completion or failure.

Lag Rat recovers these requests opportunistically when the capture worker runs.

Current recovery threshold:

```text
CAPTURE_MAX_DURATION_SECONDS + 60 seconds
```

---

## Dashboard behavior

The Traffic page can show capture request lifecycle state, including:

- requested
- queued
- running
- completed
- failed
- cancelled

Completed captures expose metadata such as output filename, capture reference, duration, and file size when available.

The Traffic page includes a confirmation step before deleting capture request history. This is intentional because completed capture requests may reference local `.pcap` files.

The Traffic page also supports a capture detail drawer, `captureRequestId` deep links, lifecycle status chips, status/source/search filters, a clear filters action, and a compact table mode for dense capture history.

---

## Security and privacy notes

Capture files can contain sensitive metadata and payloads.

Lag Rat should treat capture execution and cleanup as privileged local operations.

Guardrails:

- no remote upload by default
- no cloud sync by default
- no packet content rendering in the dashboard
- no arbitrary shell execution
- no arbitrary file deletion
- short durations only
- local file retention policy
- explicit operator action required
- confirmation before dashboard deletion

---

## Implementation order

Completed:

1. document command allowlist and retention behavior
2. add status transition fields
3. add backend status update helpers
4. add queue/cancel API shape
5. add worker skeleton
6. add test coverage for state transitions
7. add command allowlist builder
8. add output directory preparation
9. add retention cleanup
10. add execution preflight checks
11. add guarded `tcpdump` runner
12. add dashboard lifecycle status display
13. add request deletion and guarded cleanup
14. add dashboard deletion confirmation
15. add capture request detail drawer and deep links
16. add capture history filters, clear filters, status chips, and compact table mode

Near-term next steps:

- document capture troubleshooting examples
- keep packet content analysis outside Lag Rat
