# Lag Rat

## Summary

Lag Rat is a local observability platform with a current primary focus on home network observability.

The current implemented module covers:

- router monitoring
- internet monitoring
- DNS monitoring
- devices
- outages
- alerts
- reports
- metrics

Future platform expansion should leave room for:

- room-based Wi-Fi sampling
- traffic summaries / top talkers
- optional packet capture export hooks
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

## In progress

- responsive/mobile dashboard polish
- overview cohesion
- summary-surface wording cleanup
- empty / loading / partial-failure UX polish
- docs refresh
- collector/plugin boundary definition

## Current testing position

Backend integration coverage is the strongest-tested area today.

Next major testing step:

- expand frontend component/state coverage for reports, metrics, and dashboard-state handling

## Immediate next steps

- keep README aligned with the project’s current platform direction
- document the collector/plugin boundary in architecture
- align roadmap wording with the current responsive/mobile and testing priorities
