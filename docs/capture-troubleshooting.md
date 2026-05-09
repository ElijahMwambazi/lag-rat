# Capture Troubleshooting

## Purpose

This document provides operator troubleshooting notes for Lag Rat capture export workflows.

Capture export requests are local metadata and handoff records created from traffic workflows.

Lag Rat can optionally run guarded local `tcpdump` captures when execution is enabled, but packet inspection should still happen outside Lag Rat in tools such as `tcpdump` or Wireshark.

---

## Capture execution defaults

Capture execution is disabled by default.

Default behavior:

```text
CAPTURE_EXECUTION_ENABLED=false
```

When execution is disabled:

- capture requests can still be created
- capture requests can still be queued
- the worker can still pick up queued requests
- the request will fail with an execution-disabled failure reason
- no local `.pcap` file is created

This is expected behavior.

To allow guarded local capture execution:

```text
CAPTURE_EXECUTION_ENABLED=true
```

Recommended interface allowlist:

```text
CAPTURE_ALLOWED_INTERFACES=wlo1
```

Replace `wlo1` with the interface name used by the backend host.

---

## Capture readiness

The Traffic page includes a capture readiness indicator.

It reports whether Lag Rat appears ready to run guarded local captures.

Readiness checks include:

- whether capture execution is enabled
- whether `tcpdump` is available
- whether the output directory is ready
- whether duration bounds are valid
- whether allowed interface settings are valid
- which interfaces are allowlisted

The readiness indicator does not run a packet capture.

It is intended to warn the operator before queueing a request that cannot execute.

---

## Common troubleshooting cases

### Capture execution is disabled

Typical message:

```text
capture execution is not enabled
```

Meaning:

Lag Rat created and queued the request, but the backend refused to run a local capture because execution is disabled.

Fix:

```text
CAPTURE_EXECUTION_ENABLED=true
```

Then restart the backend.

Optional but recommended:

```text
CAPTURE_ALLOWED_INTERFACES=wlo1
```

---

### tcpdump is not available

Typical message:

```text
tcpdump is not available
```

Meaning:

The backend could not find `tcpdump`.

Check:

```bash
command -v tcpdump
```

If missing, install `tcpdump` using your system package manager.

Examples:

```bash
sudo dnf install tcpdump
```

```bash
sudo apt install tcpdump
```

Then restart the backend and queue a fresh capture request.

---

### Capture permission is missing

Typical messages:

```text
permission denied
```

```text
operation not permitted
```

Meaning:

`tcpdump` exists, but the backend process does not have permission to capture packets.

On Linux, one option is to grant capture capabilities to the `tcpdump` binary:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip "$(command -v tcpdump)"
```

Then verify:

```bash
getcap "$(command -v tcpdump)"
```

Expected shape:

```text
/path/to/tcpdump cap_net_admin,cap_net_raw=eip
```

Then restart the backend and queue a fresh capture request.

Use this only on a machine you control.

---

### Interface is not allowed

Typical message:

```text
capture interface is not allowed
```

Meaning:

The request targeted an interface that is not included in `CAPTURE_ALLOWED_INTERFACES`.

Fix:

```text
CAPTURE_ALLOWED_INTERFACES=wlo1
```

For multiple interfaces:

```text
CAPTURE_ALLOWED_INTERFACES=wlo1,eth0
```

Then restart the backend.

---

### Capture interface needs checking

Typical messages:

```text
no such device
```

```text
device not found
```

Meaning:

The configured or requested interface name does not exist on the backend host, or the interface is not active.

Check available interfaces:

```bash
ip link
```

For Wi-Fi interfaces, also check:

```bash
iw dev
```

Use the actual interface name in:

```text
CAPTURE_ALLOWED_INTERFACES=<interface-name>
```

---

### Capture output directory is not ready

Typical message:

```text
capture output directory
```

Meaning:

The configured capture output directory is missing, not writable, or points to a file instead of a directory.

Check:

```text
CAPTURE_OUTPUT_DIR=data/captures
```

The backend process must be able to create and write files inside that directory.

---

### Capture command timed out

Typical message:

```text
capture command timed out
```

Meaning:

The bounded capture did not finish within the expected time.

Check:

- the interface is active
- the configured duration is reasonable
- the backend process has capture permission
- the output directory is writable

Then queue a fresh capture request.

---

### Capture was recovered as stale

Typical message:

```text
recovered after becoming stale
```

Meaning:

A capture request was marked as running, but the backend likely restarted or the worker was interrupted before completion.

This is a recovery state.

If the capture is still needed, queue a fresh request.

---

## Local setup checklist

Use this checklist when enabling local capture execution.

1. Confirm `tcpdump` exists:

```bash
command -v tcpdump
```

2. Confirm the backend interface name:

```bash
ip link
```

3. Set capture execution:

```text
CAPTURE_EXECUTION_ENABLED=true
```

4. Set allowed interfaces:

```text
CAPTURE_ALLOWED_INTERFACES=wlo1
```

5. Confirm output directory:

```text
CAPTURE_OUTPUT_DIR=data/captures
```

6. Grant Linux capture capabilities if needed:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip "$(command -v tcpdump)"
```

7. Restart the backend.

8. Check the Traffic page capture readiness indicator.

9. Queue a fresh capture request.

---

## Boundary notes

Lag Rat should remain a local observability and handoff tool.

It should not become a full packet-analysis suite.

Recommended separation:

- Lag Rat: capture request metadata, readiness, lifecycle, and operator hints
- `tcpdump`: local packet capture execution
- Wireshark: packet inspection and protocol-level analysis
