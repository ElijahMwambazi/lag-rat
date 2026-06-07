# Documentation Cross-Link Guide

## Purpose

This document provides reusable cross-link blocks for Lag Rat documentation.

Use these blocks to keep the docs connected and easy to navigate without rewriting each file from scratch.

---

## Recommended pattern

Add a short **See also** section near the bottom of each core document.

Keep it small.
Use only the most relevant companion docs.
Prefer stable references over large link lists.

---

## Suggested cross-links by file

### README.md

```md
## See also

- `docs/lag-rat.md` — concise internal project brief
- `docs/architecture.md` — system shape and platform direction
- `docs/collector-plugin-boundary.md` — shared core vs module boundary
- `docs/api.md` — dashboard-facing local API contract
- `docs/capture-troubleshooting.md` — capture execution setup and failure guidance
- `docs/database-schema.md` — persistence model
- `docs/roadmap.md` — implementation sequence and priorities
- `docs/experiments.md` — exploratory future work
```

### docs/lag-rat.md

```md
## See also

- `README.md` — canonical project entrypoint
- `docs/architecture.md` — current architecture and platform direction
- `docs/roadmap.md` — current priorities and sequencing
- `docs/api.md` — current dashboard-facing API
- `docs/capture-troubleshooting.md` — capture readiness and troubleshooting guide
```

### docs/architecture.md

```md
## See also

- `README.md` — project identity and current status
- `docs/collector-plugin-boundary.md` — shared core vs module boundary
- `docs/api.md` — API shape built on top of the architecture
- `docs/database-schema.md` — persistence model supporting the architecture
- `docs/capture-troubleshooting.md` — capture execution boundary and operator guidance
- `docs/roadmap.md` — current implementation priorities
```

### docs/collector-plugin-boundary.md

```md
## See also

- `docs/architecture.md` — overall system shape
- `docs/database-schema.md` — current storage model and shared primitives
- `docs/api.md` — current API contract and likely future expansion shape
- `docs/capture-troubleshooting.md` — capture workflow guardrails and handoff boundary
- `docs/experiments.md` — possible future modules and exploratory directions
- `docs/roadmap.md` — when boundary-related work becomes active build work
```

### docs/api.md

```md
## See also

- `README.md` — project identity and current status
- `docs/architecture.md` — system structure behind the API
- `docs/collector-plugin-boundary.md` — shared vs module-specific API shaping
- `docs/capture-troubleshooting.md` — setup and failure guidance for capture workflows
- `docs/database-schema.md` — storage model behind API summaries and histories
- `docs/roadmap.md` — near-term API-adjacent priorities
```

### docs/capture-troubleshooting.md

```md
## See also

- `docs/api.md` — capture request and readiness endpoint contract
- `docs/architecture.md` — capture handoff boundary in the platform architecture
- `docs/database-schema.md` — capture request persistence model
- `docs/roadmap.md` — completed and planned capture workflow work
```

### docs/database-schema.md

```md
## See also

- `docs/architecture.md` — system structure and persistence role
- `docs/collector-plugin-boundary.md` — shared primitives vs module-specific data
- `docs/api.md` — current API built on top of the schema
- `docs/capture-troubleshooting.md` — capture output and lifecycle behavior from an operator view
- `docs/roadmap.md` — likely next schema-affecting work
```

### docs/roadmap.md

```md
## See also

- `README.md` — high-level project status
- `docs/lag-rat.md` — concise internal project brief
- `docs/architecture.md` — architectural context for roadmap items
- `docs/collector-plugin-boundary.md` — platform-shaping direction
- `docs/capture-troubleshooting.md` — capture workflow setup and troubleshooting notes
- `docs/experiments.md` — ideas that are not yet roadmap commitments
```

### docs/experiments.md

```md
## See also

- `docs/roadmap.md` — committed build priorities
- `docs/collector-plugin-boundary.md` — boundary rules for future modules
- `docs/architecture.md` — broader platform direction
- `docs/capture-troubleshooting.md` — current capture handoff behavior before future packet experiments
```

---

## Cross-link rules

When adding or updating cross-links:

- link only to docs that are directly useful from that file
- avoid repeating the full index everywhere
- keep descriptions short and practical
- prefer consistency across files
- update cross-links when a new core doc is introduced

---

## Maintenance notes

When updating this file:

- keep the snippets copy-paste friendly
- treat this as a reusable documentation utility, not a narrative doc
- revise the snippets when the docs set changes meaningfully
