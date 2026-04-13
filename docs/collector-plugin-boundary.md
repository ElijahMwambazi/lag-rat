# Collector / Plugin Boundary

## Purpose

This document defines the boundary between Lag Rat's shared platform core and its module-specific collectors.

Lag Rat should be treated as a **local observability platform** with a current primary focus on **home network observability**.

The goal of this boundary is to make future expansion possible without rewriting the core platform each time a new observability domain is added.

---

## Why this boundary exists

Lag Rat already has a working local API, storage model, alerting flow, reports, metrics, and dashboard surfaces.

As the project grows, new domains such as:

- room-based Wi-Fi sampling
- traffic summaries / top talkers
- optional packet capture export hooks
- Bitcoin node observability
- Lightning observability

should plug into shared platform patterns rather than introducing separate one-off architectures.

---

## Shared platform responsibilities

The shared platform should own the parts of the system that remain useful across modules.

### Runtime and orchestration

- scheduling
- collector execution
- task coordination
- shared configuration loading
- error handling and logging

### Persistence and history

- local storage
- migration management
- common history/timeline patterns
- incident lifecycle persistence
- report and summary aggregation support

### Incident and reporting primitives

- alerts
- outages or outage-like incident records
- histories / timelines
- summary cards
- trend views
- recent event feeds
- snapshot/export payloads

### API and dashboard contracts

- local API delivery
- shared response conventions
- dashboard navigation structure
- detail drawer patterns
- time-window controls
- empty / loading / partial-failure state conventions

---

## Module responsibilities

A module should own what is specific to its observability domain.

That includes:

- collection logic
- target definitions
- domain-specific identifiers
- domain-specific interpretation rules
- domain-specific summaries
- module-specific drill-down details

A module should not re-implement platform features that already exist in shared form.

---

## Collector responsibilities

A collector is the runtime unit that gathers observations for a module.

A collector should be responsible for:

- running a specific observation workflow
- producing structured observations
- recording enough context for later summaries
- surfacing success/failure information clearly
- handing results to the shared persistence/incident layer

Examples in the current network module:

- router TCP reachability check
- internet TCP reachability check
- internet HTTP reachability check
- DNS lookup timing check
- device inventory/activity ingestion

---

## What a collector should produce

Collectors should produce normalized outputs that are easy for the shared platform to consume.

At a minimum, a collector result should aim to answer:

- what was checked or observed
- when it was checked
- whether it succeeded or failed
- what target or entity it refers to
- what key measurements were observed
- what human-meaningful error or status context exists

Typical fields will vary by module, but the model should stay consistent.

### Common result shape ideas

Possible shared result concepts:

- `module`
- `collector_type`
- `target`
- `entity_type`
- `entity_key`
- `timestamp`
- `success`
- `status`
- `latency_ms`
- `error_message`
- `metadata`

Not every module will use every field, but the platform should encourage a familiar shape.

---

## Shared primitives all modules should try to reuse

Future modules should reuse these patterns where possible:

### Incident primitives

- alert state
- severity
- acknowledgment
- resolution
- history/timeline events

### Reporting primitives

- summary blocks
- trend buckets
- recent event lists
- top incident or top entity views
- snapshot/export payloads

### UI primitives

- list/table surfaces
- detail drawers
- timeline sections
- time-window filters
- operator-friendly summary wording

Reusing these primitives is what makes Lag Rat feel like one platform rather than a collection of unrelated tools.

---

## Current module: home network observability

The first implemented module is **home network observability**.

It currently includes:

- router monitoring
- internet monitoring
- DNS monitoring
- devices
- outages
- alerts
- reports
- metrics

This module should be treated as the reference implementation for how collectors integrate with the platform.

---

## How future modules should fit

### Wi-Fi sampling

Likely module-owned concerns:

- room/location labels
- RSSI values
- band information
- repeated sampling workflows

Likely shared-platform concerns:

- history
- trends
- summaries
- alerts if sampling thresholds matter
- dashboard presentation patterns

### Traffic summaries / top talkers

Likely module-owned concerns:

- interface/device counters
- protocol/category breakdowns
- top talker ranking logic

Likely shared-platform concerns:

- report windows
- summary surfaces
- export hooks
- UI patterns

### Optional packet capture export hooks

Likely module-owned concerns:

- capture trigger conditions
- capture reference metadata
- target/device association

Likely shared-platform concerns:

- export metadata recording
- incident linkage
- operator-facing summaries

### Bitcoin node observability

Likely module-owned concerns:

- sync status
- peer state
- mempool and chain health metrics
- node-specific incident logic

Likely shared-platform concerns:

- alert lifecycle
- summaries
- trends
- recent events
- drill-down presentation patterns

### Lightning observability

Likely module-owned concerns:

- peer/channel state
- forwarding summaries
- liquidity health
- payment/error signals

Likely shared-platform concerns:

- alerts
- reports
- trends
- timelines
- dashboard surfaces

---

## Practical rules for future implementation

When adding a new module:

1. define the collector inputs and targets
2. define the normalized observation/result shape
3. map module-specific results onto shared incident/reporting primitives
4. reuse existing dashboard patterns before creating new ones
5. add only the module-specific storage or API shape that is actually needed

When a new domain does **not** fit existing primitives well, update the shared platform deliberately rather than working around it informally.

---

## Design guardrails

Lag Rat should avoid becoming:

- a full packet-analysis suite
- a Wireshark replacement
- a collection of unrelated dashboards with different interaction models

Lag Rat should aim to be:

- local-first
- operator-friendly
- summary-oriented
- extensible
- consistent across modules

Deep forensic workflows can still exist, but they should usually connect through export hooks or focused drill-down rather than dominate the core platform.

---

## Current boundary summary

### Shared core owns

- scheduling
- persistence
- incidents
- histories
- reports
- metrics summaries
- API conventions
- dashboard conventions

### Modules own

- collection logic
- targets/entities
- domain-specific metrics
- domain-specific interpretation
- specialized drill-down detail

### Collectors own

- observation execution
- normalized results
- clear success/failure context
- handoff into the shared platform pipeline

---

## Maintenance notes

When updating this file:

- keep the boundary principles stable even if implementation details change
- document new module examples without bloating the shared-core rules
- prefer describing reusable patterns over temporary implementation quirks
- update this file when a new observability domain becomes real platform work
