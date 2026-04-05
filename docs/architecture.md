# Architecture

```text
[ Router / Internet / LAN Devices ]
                |
                v
        [ Rust Collector Service ]
                |
      +---------+----------+
      |                    |
      v                    v
[ SQLite / Metrics DB ]   [ Local API ]
                                |
                                v
                   [ React + TypeScript Dashboard ]
```

## Core backend responsibilities
- scheduled probes
- DNS checks
- persistence
- summary queries
- API delivery

## Core frontend responsibilities
- current network health
- historical charts
- outage views
- device tables
