# Documentation Index

## Purpose

This document is the entrypoint for Lag Rat documentation.

Use it to quickly find the right document for the task at hand and to reduce documentation drift as the project grows.

Lag Rat should be treated as a **local observability platform** with a current primary focus on **home network observability**.

---

## Core project docs

### Project overview

- `README.md`
  - canonical project entrypoint
  - current status
  - project identity
  - stack
  - priorities

### Current project brief

- `docs/lag-rat.md`
  - concise internal summary
  - current implementation state
  - active work
  - immediate next steps

### Architecture

- `docs/architecture.md`
  - current system shape
  - platform responsibilities
  - module responsibilities
  - near-term additions
  - future modules

### Collector / plugin boundary

- `docs/collector-plugin-boundary.md`
  - shared core vs module boundary
  - collector responsibilities
  - normalized result shape
  - design guardrails for future modules

### API

- `docs/api.md`
  - current local API contract
  - dashboard-facing endpoints
  - current module scope
  - future API direction

### Database schema

- `docs/database-schema.md`
  - current persistence model
  - shared platform primitives
  - current module tables
  - planned schema extensions

### Capture execution plan

- `docs/capture-execution-plan.md`

### Roadmap

- `docs/roadmap.md`
  - implementation sequence
  - current milestone
  - near-term work
  - later enhancements

### Experiments

- `docs/experiments.md`
  - exploratory ideas
  - future research directions
  - non-committed investigations

---

## Recommended reading paths

### If you are new to the project

Read in this order:

1. `README.md`
2. `docs/lag-rat.md`
3. `docs/architecture.md`
4. `docs/api.md`
5. `docs/database-schema.md`

### If you are working on architecture or future expansion

Read in this order:

1. `docs/architecture.md`
2. `docs/collector-plugin-boundary.md`
3. `docs/database-schema.md`
4. `docs/api.md`
5. `docs/roadmap.md`

### If you are working on dashboard/frontend features

Read in this order:

1. `README.md`
2. `docs/api.md`
3. `docs/roadmap.md`
4. `docs/lag-rat.md`

### If you are exploring future observability modules

Read in this order:

1. `docs/collector-plugin-boundary.md`
2. `docs/architecture.md`
3. `docs/experiments.md`
4. `docs/roadmap.md`

---

## Documentation rules

To keep documentation easy to edit in the future:

- keep one primary purpose per file
- keep current implemented behavior separate from future direction
- keep speculative ideas in `experiments.md`
- keep implementation sequencing in `roadmap.md`
- keep system-shape decisions in `architecture.md`
- keep module-boundary decisions in `collector-plugin-boundary.md`
- prefer additive edits over rewrites
- update cross-links when adding a new core doc

---

## Naming guidance

Prefer one naming style across docs.

Recommended style:

- hyphen-separated file names

Examples:

- `lag-rat.md`
- `database-schema.md`
- `collector-plugin-boundary.md`

Avoid mixing underscore and hyphen styles for documents that live in the same docs set unless there is a strong reason.

---

## Maintenance notes

When updating this file:

- add new docs only when they represent a real recurring documentation need
- place each new doc under the most relevant category above
- update the recommended reading paths when the doc set meaningfully changes
- keep this index short enough to scan quickly
