# Lag Rat

## Summary

Lag Rat is a local observability platform with a current primary focus on home network observability.

The current implemented module covers:

- router monitoring
- internet monitoring
- DNS monitoring
- devices
- Wi-Fi sampling
- traffic summaries and top talkers
- capture export and guarded local capture handoff
- investigations
- outages
- alerts
- reports
- metrics

Future platform expansion should leave room for:

- richer room-by-room Wi-Fi workflows
- capture output usability follow-ups
- Prometheus-compatible export
- Bitcoin node observability
- Lightning observability

## Current status

Lag Rat is in a late MVP / early productization phase.

Stable today:

- local API and dashboard flow
- core monitoring and persistence
- outage lifecycle
- alert lifecycle and acknowledgment
- device inventory with history
- reports and metrics summaries
- shared detail drawer patterns
- backend integration coverage for major dashboard APIs
- Wi-Fi sample ingest, persistence, summaries, and alerting
- Wi-Fi room comparison, timelines, recoveries, and sample detail drawers
- traffic summary, top talker, and recent sample API/client flows
- investigation read model and cross-page investigation workflows
- capture export request lifecycle and Traffic page capture history
- guarded local `tcpdump` execution with readiness checks
- device-scoped capture filters and Device drawer capture action
- completed capture file guidance and copy-path workflow
- device inventory with history, labels, confidence scoring, and low-confidence filtering

## In progress

- docs alignment with current Wi-Fi, traffic, investigation, and capture workflows
- capture output usability follow-ups after real `.pcap` workflow testing
- dashboard polish after capture workflow testing
- future module onboarding patterns

## Current testing position

Backend integration coverage is strong across the main dashboard-facing API surface.

Frontend coverage now includes major dashboard, drawer, query-param, filter, and capture workflows.

Next major testing step:

- expand coverage around future module onboarding patterns and any new capture output usability follow-ups

## Immediate next steps

- align README and docs with the current implemented capture and traffic workflows
- keep `docs/api.md`, `docs/database-schema.md`, and `docs/architecture.md` current as capture metadata and traffic workflows evolve
- keep packet inspection outside Lag Rat while improving capture handoff clarity
- continue future module planning through the collector/plugin boundary
