import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QueryState from "../components/QueryState";
import {
  api,
  Outage,
  type IncidentTargetSummaryItem,
  type RecentAlertEventItem,
  type RecentDeviceEventItem,
} from "../services/api";
import ReportsTrendCharts from "../components/ReportsTrendCharts";
import StatCard from "../components/StatCard";
import StateCard from "../components/StateCard";
import OutageDetailDrawer from "../components/OutageDetailDrawer";
import DataTableCard from "../components/DataTableCard";
import CollapsibleInspectionSection from "../components/CollapsibleInspectionSection";
import PageFilterBar from "../components/PageFilterBar";
import InspectionHighlightCard from "../components/InspectionHighlightCard";
import {
  buildAlertHeadline,
  buildAlertSubtext,
  formatAlertEventTransition,
  formatIncidentType,
} from "../utils/incidentText";

type StatusFilter = "all" | "active" | "resolved";
type TypeFilter = "all" | "internet_http" | "internet_tcp" | "dns" | "router";

type SortKey =
  | "started_desc"
  | "started_asc"
  | "duration_desc"
  | "duration_asc";

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—";
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

function formatDeviceEventType(eventType: string) {
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

function formatTransition(
  previousValue?: string | null,
  newValue?: string | null,
) {
  if (!previousValue && !newValue) return null;
  if (!previousValue && newValue) return `Set to ${newValue}`;
  if (previousValue && !newValue) return `Removed: ${previousValue}`;
  return `${previousValue} → ${newValue}`;
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
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
    params.windowHours === 24 ? "last 24 hours" : "last 7 days";

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
    params.activeCriticalAlertCount !== undefined &&
    params.activeUnacknowledgedAlertCount !== undefined
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

  if (params.deviceHistoryEventCount !== undefined) {
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
        params.topIncidentTarget.total_downtime_seconds,
      )} downtime.`,
    );
  }

  return parts.join(" ");
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function downloadFile(filename: string, content: string, mimeType: string) {
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

function formatWindowLabel(windowHours: 24 | 168) {
  return windowHours === 24 ? "24h" : "7d";
}

function formatReportsWindowLabel(windowHours: 24 | 168) {
  return `Last ${windowHours === 24 ? "24h" : "7d"}`;
}

function outageStartsWithinWindow(startedAt: string, windowHours: 24 | 168) {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return false;

  const windowStart = Date.now() - windowHours * 60 * 60 * 1000;

  return started.getTime() >= windowStart;
}

export default function ReportsPage() {
  const [selectedOutage, setSelectedOutage] = useState<Outage | null>(null);
  const [outageDrawerOpen, setOutageDrawerOpen] = useState(false);
  const [windowHours, setWindowHours] = useState<24 | 168>(24);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("started_desc");

  const [isExportingSnapshot, setIsExportingSnapshot] = useState(false);

  const [showTopIncidentTargets, setShowTopIncidentTargets] = useState(true);

  const [showOutageExplorer, setShowOutageExplorer] = useState(false);

  const reportsSummaryQuery = useQuery({
    queryKey: ["reports-summary", windowHours],
    queryFn: () => api.getReportsSummary(windowHours),
    refetchInterval: 60000,
  });

  const reportsSummary = reportsSummaryQuery.data;

  const reportTrendsQuery = useQuery({
    queryKey: ["reports-trends", windowHours],
    queryFn: () => api.getReportTrends(windowHours),
    refetchInterval: 60000,
  });

  const reportTrends = reportTrendsQuery.data ?? [];

  const recentAlertEventsQuery = useQuery({
    queryKey: ["reports-alert-events", windowHours],
    queryFn: () => api.getRecentReportAlertEvents(windowHours),
    refetchInterval: 60000,
  });

  const recentDeviceEventsQuery = useQuery({
    queryKey: ["reports-device-events", windowHours],
    queryFn: () => api.getRecentReportDeviceEvents(windowHours),
    refetchInterval: 60000,
  });

  const recentAlertEvents = recentAlertEventsQuery.data ?? [];
  const recentDeviceEvents = recentDeviceEventsQuery.data ?? [];

  const topIncidentTargetsQuery = useQuery({
    queryKey: ["reports-top-incident-targets", windowHours],
    queryFn: () => api.getTopIncidentTargets(windowHours),
    refetchInterval: 60000,
  });

  const topIncidentTargets = topIncidentTargetsQuery.data ?? [];

  const outagesQuery = useQuery({
    queryKey: [
      "outages",
      windowHours,
      statusFilter,
      typeFilter,
      search,
      sortBy,
    ],
    queryFn: () =>
      api.getOutages({
        status: statusFilter === "all" ? undefined : statusFilter,
        outage_type: typeFilter === "all" ? undefined : typeFilter,
        search: search.trim() || undefined,
        limit: 200,
      }),
    refetchInterval: 60000,
  });

  const outages = outagesQuery.data ?? [];

  const windowedOutages = useMemo(
    () =>
      outages.filter((outage) =>
        outageStartsWithinWindow(outage.started_at, windowHours),
      ),
    [outages, windowHours],
  );

  const visibleOutages = useMemo(() => {
    return [...windowedOutages].sort((a, b) => {
      if (sortBy === "started_asc") {
        return (
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
        );
      }

      if (sortBy === "duration_desc") {
        return (b.duration_seconds ?? -1) - (a.duration_seconds ?? -1);
      }

      if (sortBy === "duration_asc") {
        return (
          (a.duration_seconds ?? Number.MAX_SAFE_INTEGER) -
          (b.duration_seconds ?? Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
    });
  }, [windowedOutages, sortBy]);

  const topIncidentTarget = topIncidentTargets[0] ?? null;

  const reportNarrative = reportsSummary
    ? buildReportNarrative({
        windowHours,
        uptimePct: reportsSummary.uptime_pct,
        outageCount: reportsSummary.outage_count,
        totalDowntimeSeconds: reportsSummary.total_downtime_seconds,
        dnsFailureCount: reportsSummary.dns_failure_count,
        activeAlertCount: reportsSummary.active_alert_count,
        activeCriticalAlertCount: reportsSummary.active_critical_alert_count,
        activeUnacknowledgedAlertCount:
          reportsSummary.active_unacknowledged_alert_count,
        deviceHistoryEventCount: reportsSummary.device_history_event_count,
        topIncidentTarget: topIncidentTarget
          ? {
              target: topIncidentTarget.target,
              count: topIncidentTarget.count,
              total_downtime_seconds: topIncidentTarget.total_downtime_seconds,
            }
          : null,
      })
    : null;

  function openIncidentTargetInExplorer(item: IncidentTargetSummaryItem) {
    setShowOutageExplorer(true);
    setSearch(item.target);
    setTypeFilter(item.incident_type as TypeFilter);
    setStatusFilter(item.active_count > 0 ? "active" : "resolved");
    setSortBy("started_desc");
  }

  const activeCount = outages.filter(
    (outage) => outage.status === "active",
  ).length;

  const inspectionPanelBodyClass =
    "mt-3 max-h-[22rem] space-y-2.5 overflow-y-auto pr-1";

  const inspectionCardClass =
    "rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5";

  const mutedBadgeClass =
    "rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400";

  const warmBadgeClass =
    "rounded-full border border-amber-800 bg-amber-950/70 px-2 py-0.5 text-[11px] text-amber-300";

  const dangerBadgeClass =
    "rounded-full border border-red-800 bg-red-950 px-2 py-0.5 text-[11px] text-red-300";

  const alertEventsPanelClass = inspectionPanelBodyClass;

  const deviceEventsPanelClass = inspectionPanelBodyClass;

  const topIncidentTargetsPanelClass = showTopIncidentTargets
    ? inspectionPanelBodyClass
    : "";

  async function copySummaryToClipboard() {
    if (!reportNarrative) return;

    try {
      await navigator.clipboard.writeText(reportNarrative);
    } catch {
      // ignore clipboard failures
    }
  }

  async function exportReportsJson() {
    try {
      setIsExportingSnapshot(true);

      const snapshot = await api.getReportsSnapshot(windowHours);

      downloadFile(
        `lag-rat-report-${formatWindowLabel(windowHours)}.json`,
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
      ["summary", "window_hours", windowHours].map(escapeCsv).join(","),
    );
    sections.push(
      ["summary", "generated_at", new Date().toISOString()]
        .map(escapeCsv)
        .join(","),
    );
    sections.push(
      ["summary", "narrative", reportNarrative ?? ""].map(escapeCsv).join(","),
    );

    if (reportsSummary) {
      const summaryRows: Array<[string, unknown]> = [
        ["uptime_pct", reportsSummary.uptime_pct],
        ["avg_latency_ms", reportsSummary.avg_latency_ms],
        ["outage_count", reportsSummary.outage_count],
        ["total_downtime_seconds", reportsSummary.total_downtime_seconds],
        ["dns_failure_count", reportsSummary.dns_failure_count],
        [
          "device_history_event_count",
          reportsSummary.device_history_event_count,
        ],
        ["active_alert_count", reportsSummary.active_alert_count],
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
        sections.push(["summary", key, value].map(escapeCsv).join(","));
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
      `lag-rat-report-${formatWindowLabel(windowHours)}.csv`,
      sections.join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  return (
    <div className="space-y-4">
      <PageFilterBar
        title="Reports"
        description="Reporting summaries, recent incidents, and exportable operational history for the selected window."
        controls={
          <>
            <select
              value={windowHours}
              onChange={(e) =>
                setWindowHours(Number(e.target.value) as 24 | 168)
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 sm:w-auto"
            >
              <option value={24}>Last 24h</option>
              <option value={168}>Last 7d</option>
            </select>

            <button
              type="button"
              onClick={exportReportsJson}
              disabled={isExportingSnapshot}
              className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isExportingSnapshot ? "Exporting..." : "Export JSON"}
            </button>

            <button
              type="button"
              onClick={exportReportsCsv}
              className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 sm:w-auto"
            >
              Export CSV
            </button>
          </>
        }
      >
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
          {formatReportsWindowLabel(windowHours)}
        </span>

        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
          {outagesQuery.isLoading
            ? "Loading..."
            : `${visibleOutages.length} shown · ${windowedOutages.length} in window · ${activeCount} active`}
        </span>
      </PageFilterBar>

      {reportsSummaryQuery.isError ? (
        <QueryState
          title="Reports summary request failed"
          tone="error"
          message={
            reportsSummaryQuery.error instanceof Error
              ? reportsSummaryQuery.error.message
              : "The reports summary endpoint failed."
          }
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              ? String(reportsSummary.outage_count)
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `Total downtime ${formatDurationCompact(reportsSummary.total_downtime_seconds)}`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="DNS failures"
          value={
            reportsSummary
              ? String(reportsSummary.dns_failure_count)
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary
              ? `Window failure count`
              : "Waiting for report summary"
          }
        />

        <StatCard
          label="Device changes"
          value={
            reportsSummary
              ? String(reportsSummary.device_history_event_count)
              : reportsSummaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            reportsSummary ? `Recorded changes` : "Waiting for report summary"
          }
        />

        <StatCard
          label="Active alerts"
          value={
            reportsSummary
              ? String(reportsSummary.active_alert_count)
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

      <ReportsTrendCharts
        data={reportTrends}
        isLoading={reportTrendsQuery.isLoading}
        isError={reportTrendsQuery.isError}
        errorMessage={
          reportTrendsQuery.error instanceof Error
            ? reportTrendsQuery.error.message
            : "The reports trends endpoint failed."
        }
      />

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
            <h3 className="text-lg font-medium">Window summary</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Operational summary for the selected reporting window.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
              {formatReportsWindowLabel(windowHours)}
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
            <p className="text-sm text-zinc-400">Building summary...</p>
          ) : reportsSummaryQuery.isError ? (
            <p className="text-sm text-red-400">
              Could not build the report summary block.
            </p>
          ) : reportNarrative ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200">
              {reportNarrative}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              No summary is available for this reporting window yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Top incident targets</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {formatReportsWindowLabel(windowHours)} ·{" "}
                {topIncidentTargets.length} targets
              </p>
            </div>
          </div>

          {showTopIncidentTargets ? (
            <div className={topIncidentTargetsPanelClass}>
              {topIncidentTargetsQuery.isLoading ? (
                <StateCard
                  title="Top incident targets"
                  message="Loading targets..."
                />
              ) : topIncidentTargetsQuery.isError ? (
                <StateCard
                  title="Top incident targets"
                  tone="error"
                  message="Could not load targets."
                />
              ) : topIncidentTargets.length === 0 ? (
                <StateCard
                  title="Top incident targets"
                  tone="warning"
                  message="No incident targets were recorded in this window."
                />
              ) : (
                topIncidentTargets.map((item: IncidentTargetSummaryItem) => (
                  <InspectionHighlightCard
                    key={`${item.incident_type}-${item.target}`}
                    onClick={() => openIncidentTargetInExplorer(item)}
                    ariaLabel={`Inspect incident target ${item.target}`}
                    className="border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/80"
                    title={item.target}
                    subtitle={formatIncidentType(item.incident_type)}
                    statusLabel={
                      item.active_count > 0
                        ? `${item.active_count} active`
                        : undefined
                    }
                    statusBadgeClassName={dangerBadgeClass}
                    primaryLabel="Incidents"
                    primaryValue={`${item.count} incidents`}
                    metrics={[
                      {
                        label: "Downtime",
                        value: `${formatDurationCompact(
                          item.total_downtime_seconds,
                        )} downtime`,
                      },
                      {
                        label: "Latest",
                        value: formatDate(item.latest_started_at),
                      },
                    ]}
                    footerLabel="Status"
                    footerValue={
                      item.active_count > 0
                        ? "Currently active"
                        : "No active incidents"
                    }
                    actionHint="Open explorer"
                  />
                ))
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              Incident target ranking is collapsed.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <div>
            <div>
              <h3 className="text-lg font-medium">Recent alert events</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {formatReportsWindowLabel(windowHours)} ·{" "}
                {recentAlertEvents.length} events
              </p>
            </div>
          </div>

          <div className={alertEventsPanelClass}>
            {recentAlertEventsQuery.isLoading ? (
              <StateCard
                title="Recent alert events"
                message="Loading events..."
              />
            ) : recentAlertEventsQuery.isError ? (
              <StateCard
                title="Recent alert events"
                tone="error"
                message="Could not load events."
              />
            ) : recentAlertEvents.length === 0 ? (
              <StateCard
                title="Recent alert events"
                tone="warning"
                message="No recent alert events were recorded in this window."
              />
            ) : (
              recentAlertEvents.map((item: RecentAlertEventItem) => (
                <div
                  key={`${item.alert_id}-${item.created_at}-${item.event_type}`}
                  className={inspectionCardClass}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        {formatAlertEventType(item.event_type)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-300">
                        {buildAlertHeadline({
                          entityType: item.entity_type,
                          entityKey: item.entity_key,
                          message: item.message,
                        })}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        {
                          buildAlertSubtext({
                            entityType: item.entity_type,
                            entityKey: item.entity_key,
                            message: item.message,
                          }).targetLabel
                        }
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {formatAlertEventTransition({
                    eventType: item.event_type,
                    previousValue: item.previous_value,
                    newValue: item.new_value,
                  }) ? (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {formatAlertEventTransition({
                        eventType: item.event_type,
                        previousValue: item.previous_value,
                        newValue: item.new_value,
                      })}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <div>
            <div>
              <h3 className="text-lg font-medium">Recent device changes</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {formatReportsWindowLabel(windowHours)} ·{" "}
                {recentDeviceEvents.length} events
              </p>
            </div>
          </div>

          <div className={deviceEventsPanelClass}>
            {recentDeviceEventsQuery.isLoading ? (
              <StateCard
                title="Recent device changes"
                message="Loading device activity..."
              />
            ) : recentDeviceEventsQuery.isError ? (
              <StateCard
                title="Recent device changes"
                tone="error"
                message="Could not load recent device activity."
              />
            ) : recentDeviceEvents.length === 0 ? (
              <StateCard
                title="Recent device changes"
                tone="warning"
                message="No recent device events in this window."
              />
            ) : (
              recentDeviceEvents.map((item: RecentDeviceEventItem) => (
                <div
                  key={`${item.device_ip_address}-${item.created_at}-${item.event_type}`}
                  className={inspectionCardClass}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        {formatDeviceEventType(item.event_type)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {item.device_ip_address}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {formatTransition(item.previous_value, item.new_value) ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-zinc-500">
                      {formatTransition(item.previous_value, item.new_value)}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <CollapsibleInspectionSection
        title="Outage explorer"
        description="Search, filter, and inspect outage records within the selected reporting window."
        badges={
          <>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
              {visibleOutages.length} record
              {visibleOutages.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
              {formatReportsWindowLabel(windowHours)}
            </span>
          </>
        }
        collapsedSummary="Outage explorer is collapsed by default. Expand the table to search, filter, and inspect outage records."
        collapsedDetail="Expand outage explorer to search, filter, and inspect outage records for the selected reporting window."
        collapsedActionLabel="Show explorer"
        expandedActionLabel="Hide explorer"
        isExpanded={showOutageExplorer}
        onToggle={() => setShowOutageExplorer((current) => !current)}
      >
        <>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-100">
                Explorer controls
              </h4>
              <p className="text-sm leading-6 text-zinc-400">
                Filter outage records by target, incident type, state, and sort
                order.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,180px))]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search target, type, status, error..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:col-span-2 xl:col-span-1"
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
              >
                <option value="all">All types</option>
                <option value="internet_http">internet_http</option>
                <option value="internet_tcp">internet_tcp</option>
                <option value="dns">dns</option>
                <option value="router">router</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
              >
                <option value="started_desc">Newest first</option>
                <option value="started_asc">Oldest first</option>
                <option value="duration_desc">Longest duration</option>
                <option value="duration_asc">Shortest duration</option>
              </select>
            </div>
          </div>

          <DataTableCard
            title="Outage records"
            description="Filtered outage records for the selected reporting window."
            rightSlot={
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                  {visibleOutages.length} record
                  {visibleOutages.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                  {formatReportsWindowLabel(windowHours)}
                </span>
              </div>
            }
            helperText="Swipe horizontally to view all outage columns. Tap a row to inspect full incident details."
            isLoading={outagesQuery.isLoading}
            isError={outagesQuery.isError}
            errorMessage={
              outagesQuery.error instanceof Error
                ? outagesQuery.error.message
                : "Outage records could not be loaded."
            }
            emptyTitle="Outage records"
            emptyMessage="No outage records matched the selected filters."
            hasData={visibleOutages.length > 0}
            tableMinWidthClassName="min-w-[1040px]"
            variant="flush"
          >
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50 text-zinc-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Started</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-left font-medium">Cause</th>
                </tr>
              </thead>
              <tbody>
                {visibleOutages.map((outage) => (
                  <tr
                    key={outage.id}
                    onClick={() => {
                      setSelectedOutage(outage);
                      setOutageDrawerOpen(true);
                    }}
                    className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-3 text-zinc-300">
                      {formatDate(outage.started_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-100">
                      {formatIncidentType(outage.outage_type)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{outage.target}</td>
                    <td className="px-4 py-3 text-zinc-300">{outage.status}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {formatDuration(outage.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {outage.start_error ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <OutageDetailDrawer
              outage={selectedOutage}
              open={outageDrawerOpen && !!selectedOutage}
              onClose={() => {
                setOutageDrawerOpen(false);
                setSelectedOutage(null);
              }}
            />
          </DataTableCard>
        </>
      </CollapsibleInspectionSection>
    </div>
  );
}
