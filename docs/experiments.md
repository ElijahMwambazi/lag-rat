# Experiments

## Purpose

This document collects higher-level follow-on experiments for Lag Rat once the current dashboard/productization phase is more stable and the collector/module boundary is clearer.

These are exploratory directions, not committed roadmap items.

---

## Reliability and network behavior

- compare 2.4 GHz vs 5 GHz latency
- measure outage frequency by time of day
- compare DNS resolver response times
- compare internet HTTP vs internet TCP reliability over time
- measure recovery time patterns across outage types
- track whether certain targets fail together

---

## Device and local environment experiments

- track room-by-room Wi-Fi performance
- compare device activity patterns by time of day
- study how long devices disappear before being seen again
- explore richer device labeling and confidence scoring

---

## Reporting and observability experiments

- compare 24h vs 7d reporting usefulness for home diagnostics
- evaluate which alert wording is easiest to scan
- test different incident ranking strategies beyond count-first ordering
- explore weekly summary generation or scheduled exports

---

## Wi-Fi mapping experiments

- compare signal strength across named rooms
- correlate RSSI with latency and packet loss
- compare 2.4 GHz and 5 GHz behavior by location

---

## Packet and tooling experiments

- compare completed capture handoff workflows against external Wireshark/tcpdump inspection habits
- compare summary-level traffic counters vs full captures for usefulness
- evaluate how much packet-level detail belongs inside Lag Rat vs external tools

---

## Later research directions

- Wi-Fi signal mapping workflow
- ISP performance comparison
- Prometheus-compatible export
- packet capture / PCAP correlation
- anomaly detection or unusual-home-network behavior summaries

---

## Future module experiments

- compare Bitcoin node health metrics that are most operator-useful
- explore Lightning peer/channel summary models
- test whether current alert/report primitives are sufficient for Bitcoin/Lightning modules

---

## Maintenance notes

When updating this file:

- keep this document exploratory rather than implementation-focused
- move committed work into the roadmap once it becomes a real build priority
- group related experiments instead of adding one-off notes randomly
- prefer short, testable experiment statements over broad aspirations
