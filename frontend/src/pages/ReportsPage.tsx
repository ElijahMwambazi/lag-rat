import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import {
  api,
  Outage,
  type IncidentTargetSummaryItem,
  type RecentAlertEventItem,
  type RecentDeviceEventItem,
} from "../services/api";

type StatusFilter = "all" | "active" | "resolved";
type TypeFilter =
  | "all"
  | "internet_http"
  | "internet_tcp"
  | "dns"
  | "router";

type SortKey =
  | "started_desc"
  | "started_asc"
  | "duration_desc"
  | "duration_asc";

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined)
    return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDurationCompact(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatAlertEventType(eventType: string) {
  switch (eventType) {
    case "opened":
      return "Opened";
    case "severity_changed":
      return "Severity changed";
    case "message_changed":
      return "Message changed";
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function formatDeviceEventType(
  eventType: string,
) {
  switch (eventType) {
    case "first_seen":
      return "First seen";
    case "seen_again":
      return "Seen again";
    case "mac_changed":
      return "MAC changed";
    case "hostname_changed":
      return "Hostname changed";
    case "label_changed":
      return "Label changed";
    case "label_added":
      return "Label added";
    case "notes_changed":
      return "Notes changed";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function formatIncidentType(value: string) {
  return value.replace(/_/g, " ");
}

function formatTransition(
  previousValue?: string | null,
  newValue?: string | null,
) {
  if (!previousValue && !newValue) return null;
  if (!previousValue && newValue)
    return `Set to ${newValue}`;
  if (previousValue && !newValue)
    return `Removed: ${previousValue}`;
  return `${previousValue} → ${newValue}`;
}

function pluralize(
  value: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildReportNarrative(params: {
  windowHours: 24 | 168;
  uptimePct?: number;
  outageCount?: number;
  totalDowntimeSeconds?: number;
  dnsFailureCount?: number;
  activeAlertCount?: number;
  activeCriticalAlertCount?: number;
  activeUnacknowledgedAlertCount?: number;
  deviceHistoryEventCount?: number;
  topIncidentTarget?: {
    target: string;
    count: number;
    total_downtime_seconds: number;
  } | null;
}) {
  const windowLabel =
    params.windowHours === 24
      ? "last 24 hours"
      : "last 7 days";

  const parts: string[] = [];

  if (params.uptimePct !== undefined) {
    parts.push(
      `Network uptime was ${params.uptimePct.toFixed(1)}% over the ${windowLabel}.`,
    );
  }

  if (
    params.outageCount !== undefined &&
    params.totalDowntimeSeconds !== undefined
  ) {
    parts.push(
      `${pluralize(params.outageCount, "outage")} recorded, with ${formatDurationCompact(
        params.totalDowntimeSeconds,
      )} total downtime.`,
    );
  }

  if (params.dnsFailureCount !== undefined) {
    parts.push(
      `${pluralize(params.dnsFailureCount, "DNS failure")} occurred in this window.`,
    );
  }

  if (
    params.activeAlertCount !== undefined &&
    params.activeCriticalAlertCount !==
      undefined &&
    params.activeUnacknowledgedAlertCount !==
      undefined
  ) {
    parts.push(
      `There are currently ${pluralize(params.activeAlertCount, "active alert")}, including ${pluralize(
        params.activeCriticalAlertCount,
        "critical alert",
      )} and ${pluralize(
        params.activeUnacknowledgedAlertCount,
        "unacknowledged alert",
      )}.`,
    );
  }

  if (
    params.deviceHistoryEventCount !== undefined
  ) {
    parts.push(
      `${pluralize(params.deviceHistoryEventCount, "device change")} were recorded.`,
    );
  }

  if (params.topIncidentTarget) {
    parts.push(
      `The most frequent incident target was ${params.topIncidentTarget.target}, with ${pluralize(
        params.topIncidentTarget.count,
        "incident",
      )} and ${formatDurationCompact(
        params.topIncidentTarget
          .total_downtime_seconds,
      )} downtime.`,
    );
  }

  return parts.join(" ");
}

function escapeCsv(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped)
    ? `"${escaped}"`
    : escaped;
}

function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
) {
  const blob = new Blob([content], {
    type: mimeType,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatWindowLabel(
  windowHours: 24 | 168,
) {
  return windowHours === 24 ? "24h" : "7d";
}

export default function ReportsPage() {
  const [selectedOutage, setSelectedOutage] =
    useState<Outage | null>(null);
  const [windowHours, setWindowHours] = useState<
    24 | 168
  >(24);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>(
    "started_desc",
  );

  const [
    isExportingSnapshot,
    setIsExportingSnapshot,
  ] = useState(false);

  const [
    showTopIncidentTargets,
    setShowTopIncidentTargets,
  ] = useState(true);

  const reportsSummaryQuery = useQuery({
    queryKey: ["reports-summary", windowHours],
    queryFn: () =>
      api.getReportsSummary(windowHours),
    refetchInterval: 60000,
  });

  const reportsSummary = reportsSummaryQuery.data;

  const recentAlertEventsQuery = useQuery({
    queryKey: [
      "reports-alert-events",
      windowHours,
    ],
    queryFn: () =>
      api.getRecentReportAlertEvents(windowHours),
    refetchInterval: 60000,
  });

  const recentDeviceEventsQuery = useQuery({
    queryKey: [
      "reports-device-events",
      windowHours,
    ],
    queryFn: () =>
      api.getRecentReportDeviceEvents(
        windowHours,
      ),
    refetchInterval: 60000,
  });

  const recentAlertEvents =
    recentAlertEventsQuery.data ?? [];
  const recentDeviceEvents =
    recentDeviceEventsQuery.data ?? [];

  const topIncidentTargetsQuery = useQuery({
    queryKey: [
      "reports-top-incident-targets",
      windowHours,
    ],
    queryFn: () =>
      api.getTopIncidentTargets(windowHours),
    refetchInterval: 60000,
  });

  const topIncidentTargets =
    topIncidentTargetsQuery.data ?? [];

  const outagesQuery = useQuery({
    queryKey: [
      "outages",
      statusFilter,
      typeFilter,
      search,
      sortBy,
    ],
    queryFn: () =>
      api.getOutages({
        status:
          statusFilter === "all"
            ? undefined
            : statusFilter,
        outage_type:
          typeFilter === "all"
            ? undefined
            : typeFilter,
        search: search.trim() || undefined,
        limit: 200,
      }),
    refetchInterval: 60000,
  });

  const outages = outagesQuery.data ?? [];

  const visibleOutages = useMemo(() => {
    return [...outages].sort((a, b) => {
      if (sortBy === "started_asc") {
        return (
          new Date(a.started_at).getTime() -
          new Date(b.started_at).getTime()
        );
      }

      if (sortBy === "duration_desc") {
        return (
          (b.duration_seconds ?? -1) -
          (a.duration_seconds ?? -1)
        );
      }

      if (sortBy === "duration_asc") {
        return (
          (a.duration_seconds ??
            Number.MAX_SAFE_INTEGER) -
          (b.duration_seconds ??
            Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        new Date(b.started_at).getTime() -
        new Date(a.started_at).getTime()
      );
    });
  }, [outages, sortBy]);

  const topIncidentTarget =
    topIncidentTargets[0] ?? null;

  const reportNarrative = reportsSummary
    ? buildReportNarrative({
        windowHours,
        uptimePct: reportsSummary.uptime_pct,
        outageCount: reportsSummary.outage_count,
        totalDowntimeSeconds:
          reportsSummary.total_downtime_seconds,
        dnsFailureCount:
          reportsSummary.dns_failure_count,
        activeAlertCount:
          reportsSummary.active_alert_count,
        activeCriticalAlertCount:
          reportsSummary.active_critical_alert_count,
        activeUnacknowledgedAlertCount:
          reportsSummary.active_unacknowledged_alert_count,
        deviceHistoryEventCount:
          reportsSummary.device_history_event_count,
        topIncidentTarget: topIncidentTarget
          ? {
              target: topIncidentTarget.target,
              count: topIncidentTarget.count,
              total_downtime_seconds:
                topIncidentTarget.total_downtime_seconds,
            }
          : null,
      })
    : null;

  const activeCount = outages.filter(
    (outage) => outage.status === "active",
  ).length;

  async function copySummaryToClipboard() {
    if (!reportNarrative) return;

    try {
      await navigator.clipboard.writeText(
        reportNarrative,
      );
    } catch {
      // ignore clipboard failures
    }
  }

  async function exportReportsJson() {
    try {
      setIsExportingSnapshot(true);

      const snapshot =
        await api.getReportsSnapshot(windowHours);

      downloadFile(
        `lag-rat-report-${formatWindowLabel(
          windowHours,
        )}.json`,
        JSON.stringify(snapshot, null, 2),
        "application/json",
      );
    } finally {
      setIsExportingSnapshot(false);
    }
  }

  function exportReportsCsv() {
    const sections: string[] = [];

    sections.push("section,key,value");
    sections.push(
      ["summary", "window_hours", windowHours]
        .map(escapeCsv)
        .join(","),
    );
    sections.push(
      [
        "summary",
        "generated_at",
        new Date().toISOString(),
      ]
        .map(escapeCsv)
        .join(","),
    );
    sections.push(
      [
        "summary",
        "narrative",
        reportNarrative ?? "",
      ]
        .map(escapeCsv)
        .join(","),
    );

    if (reportsSummary) {
      const summaryRows: Array<
        [string, unknown]
      > = [
        ["uptime_pct", reportsSummary.uptime_pct],
        [
          "avg_latency_ms",
          reportsSummary.avg_latency_ms,
        ],
        [
          "outage_count",
          reportsSummary.outage_count,
        ],
        [
          "total_downtime_seconds",
          reportsSummary.total_downtime_seconds,
        ],
        [
          "dns_failure_count",
          reportsSummary.dns_failure_count,
        ],
        [
          "device_history_event_count",
          reportsSummary.device_history_event_count,
        ],
        [
          "active_alert_count",
          reportsSummary.active_alert_count,
        ],
        [
          "active_critical_alert_count",
          reportsSummary.active_critical_alert_count,
        ],
        [
          "active_unacknowledged_alert_count",
          reportsSummary.active_unacknowledged_alert_count,
        ],
      ];

      for (const [key, value] of summaryRows) {
        sections.push(
          ["summary", key, value]
            .map(escapeCsv)
            .join(","),
        );
      }
    }

    sections.push("");
    sections.push(
      [
        "top_incident_targets",
        "incident_type",
        "target",
        "count",
        "active_count",
        "total_downtime_seconds",
        "latest_started_at",
      ].join(","),
    );

    for (const item of topIncidentTargets) {
      sections.push(
        [
          "top_incident_targets",
          item.incident_type,
          item.target,
          item.count,
          item.active_count,
          item.total_downtime_seconds,
          item.latest_started_at ?? "",
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    sections.push("");
    sections.push(
      [
        "recent_alert_events",
        "alert_id",
        "event_type",
        "severity",
        "entity_type",
        "alert_type",
        "message",
        "previous_value",
        "new_value",
        "created_at",
      ].join(","),
    );

    for (const item of recentAlertEvents) {
      sections.push(
        [
          "recent_alert_events",
          item.alert_id,
          item.event_type,
          item.severity,
          item.entity_type,
          item.alert_type,
          item.message,
          item.previous_value ?? "",
          item.new_value ?? "",
          item.created_at,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    sections.push("");
    sections.push(
      [
        "recent_device_events",
        "device_ip_address",
        "event_type",
        "previous_value",
        "new_value",
        "created_at",
      ].join(","),
    );

    for (const item of recentDeviceEvents) {
      sections.push(
        [
          "recent_device_events",
          item.device_ip_address,
          item.event_type,
          item.previous_value ?? "",
          item.new_value ?? "",
          item.created_at,
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    sections.push("");
    sections.push(
      [
        "outages",
        "id",
        "outage_type",
        "target",
        "started_at",
        "ended_at",
        "duration_seconds",
        "status",
        "start_error",
        "end_note",
      ].join(","),
    );

    for (const outage of visibleOutages) {
      sections.push(
        [
          "outages",
          outage.id,
          outage.outage_type,
          outage.target,
          outage.started_at,
          outage.ended_at ?? "",
          outage.duration_seconds ?? "",
          outage.status,
          outage.start_error ?? "",
          outage.end_note ?? "",
        ]
          .map(escapeCsv)
          .join(","),
      );
    }

    downloadFile(
      `lag-rat-report-${formatWindowLabel(
        windowHours,
      )}.csv`,
      sections.join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Reports
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={windowHours}
            onChange={(e) =>
              setWindowHours(
                Number(e.target.value) as
                  | 24
                  | 168,
              )
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7d</option>
          </select>

          <button
            type="button"
            onClick={exportReportsJson}
            disabled={isExportingSnapshot}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportingSnapshot
              ? "Exporting..."
              : "Export JSON"}
          </button>

          <button
            type="button"
            onClick={exportReportsCsv}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Export CSV
          </button>

          <p className="text-sm text-zinc-400">
            {outagesQuery.isLoading
              ? "Loading..."
              : `${visibleOutages.length} shown · ${outages.length} total · ${activeCount} active`}
          </p>
        </div>
      </div>

      {reportsSummaryQuery.isError ? (
        <QueryState
          title="Reports summary request failed"
          tone="error"
          message={
            reportsSummaryQuery.error instanceof
            Error
              ? reportsSummaryQuery.error.message
              : "The reports summary endpoint failed."
          }
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={`Uptime (${windowHours === 24 ? "24h" : "7d"})`}
          value={
            reportsSummary
              ? `${reportsSummary.uptime_pct.toFixed(1)}%`
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `Avg latency ${reportsSummary.avg_latency_ms.toFixed(1)} ms`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="Outages"
          value={
            reportsSummary
              ? String(
                  reportsSummary.outage_count,
                )
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `Downtime ${formatDurationCompact(reportsSummary.total_downtime_seconds)}`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="DNS failures"
          value={
            reportsSummary
              ? String(
                  reportsSummary.dns_failure_count,
                )
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `${windowHours === 24 ? "24h" : "7d"} failure count`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="Device changes"
          value={
            reportsSummary
              ? String(
                  reportsSummary.device_history_event_count,
                )
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `${windowHours === 24 ? "24h" : "7d"} activity`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="Active alerts"
          value={
            reportsSummary
              ? String(
                  reportsSummary.active_alert_count,
                )
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `${reportsSummary.active_unacknowledged_alert_count} unacknowledged · ${reportsSummary.active_critical_alert_count} critical`
              : "Waiting for report summary"
          }
        />
      </section>

      {outagesQuery.isError ? (
        <QueryState
          title="Reports request failed"
          tone="error"
          message={
            outagesQuery.error instanceof Error
              ? outagesQuery.error.message
              : "The outages endpoint failed."
          }
        />
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">
              Window summary
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Export-friendly operational recap
              for the selected reporting window.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
              {windowHours === 24 ? "24h" : "7d"}
            </span>

            <button
              type="button"
              onClick={copySummaryToClipboard}
              disabled={!reportNarrative}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Copy summary
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          {reportsSummaryQuery.isLoading ? (
            <p className="text-sm text-zinc-400">
              Building summary...
            </p>
          ) : reportsSummaryQuery.isError ? (
            <p className="text-sm text-red-400">
              Could not build the report summary
              block.
            </p>
          ) : reportNarrative ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200">
              {reportNarrative}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              No summary is available for this
              window yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Recent alert events
            </h3>
            <p className="text-sm text-zinc-400">
              Last{" "}
              {windowHours === 24 ? "24h" : "7d"}{" "}
              · scroll
            </p>
          </div>

          <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {recentAlertEventsQuery.isLoading ? (
              <p className="text-sm text-zinc-400">
                Loading alert activity...
              </p>
            ) : recentAlertEventsQuery.isError ? (
              <p className="text-sm text-red-400">
                Could not load recent alert
                activity.
              </p>
            ) : recentAlertEvents.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No recent alert events in this
                window.
              </p>
            ) : (
              recentAlertEvents.map(
                (item: RecentAlertEventItem) => (
                  <div
                    key={`${item.alert_id}-${item.created_at}-${item.event_type}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">
                          {formatAlertEventType(
                            item.event_type,
                          )}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-300">
                          {item.message}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.entity_type} ·{" "}
                          {item.alert_type}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatDate(
                          item.created_at,
                        )}
                      </span>
                    </div>

                    {formatTransition(
                      item.previous_value,
                      item.new_value,
                    ) ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        {formatTransition(
                          item.previous_value,
                          item.new_value,
                        )}
                      </p>
                    ) : null}
                  </div>
                ),
              )
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Recent device changes
            </h3>
            <p className="text-sm text-zinc-400">
              Last{" "}
              {windowHours === 24 ? "24h" : "7d"}{" "}
              · scroll
            </p>
          </div>

          <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {recentDeviceEventsQuery.isLoading ? (
              <p className="text-sm text-zinc-400">
                Loading device activity...
              </p>
            ) : recentDeviceEventsQuery.isError ? (
              <p className="text-sm text-red-400">
                Could not load recent device
                activity.
              </p>
            ) : recentDeviceEvents.length ===
              0 ? (
              <p className="text-sm text-zinc-400">
                No recent device events in this
                window.
              </p>
            ) : (
              recentDeviceEvents.map(
                (item: RecentDeviceEventItem) => (
                  <div
                    key={`${item.device_ip_address}-${item.created_at}-${item.event_type}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">
                          {formatDeviceEventType(
                            item.event_type,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {item.device_ip_address}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatDate(
                          item.created_at,
                        )}
                      </span>
                    </div>

                    {formatTransition(
                      item.previous_value,
                      item.new_value,
                    ) ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                        {formatTransition(
                          item.previous_value,
                          item.new_value,
                        )}
                      </p>
                    ) : null}
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">
              Top incident targets
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Last{" "}
              {windowHours === 24 ? "24h" : "7d"}{" "}
              · {topIncidentTargets.length} shown
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowTopIncidentTargets(
                (current) => !current,
              )
            }
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {showTopIncidentTargets
              ? "Collapse"
              : "Expand"}
          </button>
        </div>

        {showTopIncidentTargets ? (
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {topIncidentTargetsQuery.isLoading ? (
              <p className="text-sm text-zinc-400">
                Loading incident targets...
              </p>
            ) : topIncidentTargetsQuery.isError ? (
              <p className="text-sm text-red-400">
                Could not load incident target
                summary.
              </p>
            ) : topIncidentTargets.length ===
              0 ? (
              <p className="text-sm text-zinc-400">
                No incident targets in this
                window.
              </p>
            ) : (
              topIncidentTargets.map(
                (
                  item: IncidentTargetSummaryItem,
                ) => (
                  <div
                    key={`${item.incident_type}-${item.target}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">
                          {item.target}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatIncidentType(
                            item.incident_type,
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-300">
                          {item.count} incidents
                        </span>
                        <span className="rounded-full border border-amber-800 bg-amber-950 px-2.5 py-1 text-amber-300">
                          {formatDurationCompact(
                            item.total_downtime_seconds,
                          )}{" "}
                          downtime
                        </span>
                        {item.active_count > 0 ? (
                          <span className="rounded-full border border-red-800 bg-red-950 px-2.5 py-1 text-red-300">
                            {item.active_count}{" "}
                            active
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400">
                      Latest incident{" "}
                      {formatDate(
                        item.latest_started_at,
                      )}
                    </p>
                  </div>
                ),
              )
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Incident target ranking is collapsed.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-medium">
            Outage explorer
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Search, filter, and inspect outage
            records for the selected window.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search target, type, status, error..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:min-w-[320px]"
            />

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as TypeFilter,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="all">
                All types
              </option>
              <option value="internet_http">
                internet_http
              </option>
              <option value="internet_tcp">
                internet_tcp
              </option>
              <option value="dns">dns</option>
              <option value="router">
                router
              </option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as StatusFilter,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="all">
                All statuses
              </option>
              <option value="active">
                Active
              </option>
              <option value="resolved">
                Resolved
              </option>
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as SortKey,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="started_desc">
                Newest first
              </option>
              <option value="started_asc">
                Oldest first
              </option>
              <option value="duration_desc">
                Longest duration
              </option>
              <option value="duration_asc">
                Shortest duration
              </option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">
                  Type
                </th>
                <th className="px-4 py-3 text-left">
                  Target
                </th>
                <th className="px-4 py-3 text-left">
                  Started
                </th>
                <th className="px-4 py-3 text-left">
                  Ended
                </th>
                <th className="px-4 py-3 text-left">
                  Duration
                </th>
                <th className="px-4 py-3 text-left">
                  Status
                </th>
                <th className="px-4 py-3 text-left">
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {outagesQuery.isLoading &&
              outages.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-zinc-400"
                  >
                    Loading outages...
                  </td>
                </tr>
              ) : visibleOutages.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-zinc-400"
                  >
                    No reports match the current
                    filters.
                  </td>
                </tr>
              ) : (
                visibleOutages.map((outage) => (
                  <tr
                    key={`${outage.id}-${outage.started_at}-${outage.target}`}
                    className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                    onClick={() =>
                      setSelectedOutage(outage)
                    }
                  >
                    <td className="px-4 py-3">
                      {outage.outage_type || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {outage.target}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(
                        outage.started_at,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(
                        outage.ended_at,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {formatDuration(
                        outage.duration_seconds,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          outage.status ===
                          "active"
                            ? "rounded-full border border-red-800 bg-red-950 px-2 py-0.5 text-xs text-red-300"
                            : "rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300"
                        }
                      >
                        {outage.status}
                      </span>
                    </td>
                    <td className="max-w-[420px] px-4 py-3 text-zinc-300">
                      <div
                        className="truncate"
                        title={
                          outage.start_error ??
                          "—"
                        }
                      >
                        {outage.start_error ??
                          "—"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {selectedOutage ? (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
              <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
                  <div>
                    <h3 className="text-xl font-semibold text-zinc-100">
                      {selectedOutage.outage_type}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Outage details
                    </p>
                  </div>

                  <button
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                    onClick={() =>
                      setSelectedOutage(null)
                    }
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4 px-6 py-5 text-sm">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Target
                    </div>
                    <div className="mt-2 break-all text-zinc-100">
                      {selectedOutage.target}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Started
                      </div>
                      <div className="mt-2 text-zinc-100">
                        {formatDate(
                          selectedOutage.started_at,
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Ended
                      </div>
                      <div className="mt-2 text-zinc-100">
                        {formatDate(
                          selectedOutage.ended_at,
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Duration
                      </div>
                      <div className="mt-2 text-zinc-100">
                        {formatDuration(
                          selectedOutage.duration_seconds,
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Status
                      </div>
                      <div className="mt-2 text-zinc-100">
                        {selectedOutage.status}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Error
                    </div>
                    <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
                      {selectedOutage.start_error ??
                        "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Recovery note
                    </div>
                    <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
                      {selectedOutage.end_note ??
                        "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
