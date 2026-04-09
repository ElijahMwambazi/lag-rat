import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AlertsPanel from "../components/AlertsPanel";
import DebugPanel from "../components/DebugPanel";
import IssuePanel from "../components/IssuePanel";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatMs(value?: number | null) {
  if (value === null || value === undefined)
    return "—";
  return `${value.toFixed(1)} ms`;
}

function getQueryStatus(
  isLoading: boolean,
  isError: boolean,
  detailOk: string,
  detailLoading = "Request in progress",
  detailError = "Request failed",
): {
  status: "ok" | "loading" | "error";
  detail: string;
} {
  if (isError)
    return {
      status: "error",
      detail: detailError,
    };
  if (isLoading)
    return {
      status: "loading",
      detail: detailLoading,
    };
  return { status: "ok", detail: detailOk };
}

export default function OverviewPage() {
  const overviewQuery = useQuery({
    queryKey: ["status-overview"],
    queryFn: api.getStatusOverview,
    refetchInterval: 15000,
  });
  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: api.getSummary,
    refetchInterval: 30000,
  });
  const overview = overviewQuery.data;
  const summary = summaryQuery.data;

  const alertsSectionRef =
    useRef<HTMLDivElement | null>(null);

  const criticalAlertsQuery = useQuery({
    queryKey: [
      "alerts",
      "critical",
      "active",
      "overview",
    ],
    queryFn: () =>
      api.getAlerts({
        status: "active",
        severity: "critical",
        limit: 1,
      }),
    refetchInterval: 15000,
  });

  const criticalAlerts = (
    criticalAlertsQuery.data ?? []
  ).filter((alert) => !alert.acknowledged_at);
  const topCriticalAlert =
    criticalAlerts[0] ?? null;

  const activeUnacknowledgedCriticalCount =
    overview?.alerts
      .active_unacknowledged_critical_count ?? 0;

  const shouldShowCriticalBanner =
    activeUnacknowledgedCriticalCount > 0;

  const isCriticalBannerPreviewLoading =
    shouldShowCriticalBanner &&
    criticalAlertsQuery.isLoading &&
    !topCriticalAlert;

  const isCriticalBannerPreviewUnavailable =
    shouldShowCriticalBanner &&
    !criticalAlertsQuery.isLoading &&
    !topCriticalAlert;

  const [alertsFocusMode, setAlertsFocusMode] =
    useState<"default" | "active-critical">(
      "default",
    );

  const issues = [];
  if (overview && !overview.router.is_healthy) {
    issues.push({
      title: "Router connectivity issue",
      detail:
        overview.router.latest_error_message ??
        "Router reachability is failing.",
    });
  }
  if (overview && !overview.internet.is_healthy) {
    issues.push({
      title: "Internet connectivity issue",
      detail:
        overview.internet.latest_error_message ??
        "Public probe is failing.",
    });
  }
  if (overview && !overview.dns.is_healthy) {
    issues.push({
      title: "DNS health issue",
      detail:
        overview.dns.latest_error_message ??
        "DNS resolution is failing.",
    });
  }

  const endpoints = [
    {
      name: "/api/status/overview",
      ...getQueryStatus(
        overviewQuery.isLoading,
        overviewQuery.isError,
        "Overview payload received",
        "Waiting for overview payload",
        overviewQuery.error instanceof Error
          ? overviewQuery.error.message
          : "Overview request failed",
      ),
    },
    {
      name: "/api/stats/summary",
      ...getQueryStatus(
        summaryQuery.isLoading,
        summaryQuery.isError,
        "Summary payload received",
        "Waiting for summary payload",
        summaryQuery.error instanceof Error
          ? summaryQuery.error.message
          : "Summary request failed",
      ),
    },
    {
      name: "/api/alerts",
      ...getQueryStatus(
        criticalAlertsQuery.isLoading,
        criticalAlertsQuery.isError,
        overview
          ? `${overview.alerts.active_unacknowledged_critical_count} active unacknowledged critical alerts`
          : `${criticalAlerts.length} active critical alerts`,
        "Waiting for critical alerts payload",
        criticalAlertsQuery.error instanceof Error
          ? criticalAlertsQuery.error.message
          : "Alerts request failed",
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">
              Overview
            </h2>
            <p className="mt-2 text-zinc-400">
              Current health snapshot for your
              network.
            </p>
          </div>
          {overview ? (
            <p className="text-sm text-zinc-400">
              Last check{" "}
              {formatDate(overview.checked_at)}
            </p>
          ) : null}
        </div>
      </section>

      <DebugPanel endpoints={endpoints} />

      {overviewQuery.isError ? (
        <QueryState
          title="Overview request failed"
          tone="error"
          message={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "The overview endpoint failed."
          }
        />
      ) : null}

      {shouldShowCriticalBanner ? (
        <section className="rounded-2xl border border-red-900 bg-red-950/40 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-red-300">
                Active critical alert
              </h3>

              {topCriticalAlert ? (
                <>
                  <p className="mt-1 text-base font-medium text-zinc-100">
                    {topCriticalAlert.message}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {topCriticalAlert.entity_type}{" "}
                    ·{" "}
                    {topCriticalAlert.alert_type}{" "}
                    ·{" "}
                    {formatDate(
                      topCriticalAlert.created_at,
                    )}
                  </p>
                </>
              ) : isCriticalBannerPreviewLoading ? (
                <>
                  <p className="mt-1 text-base font-medium text-zinc-100">
                    Loading critical alert
                    details...
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Alert preview is being
                    refreshed.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-base font-medium text-zinc-100">
                    Critical alerts require
                    attention.
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Preview details are
                    temporarily unavailable.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-red-800 bg-red-950 px-2.5 py-1 text-xs text-red-300">
                {
                  activeUnacknowledgedCriticalCount
                }{" "}
                critical unacknowledged
              </span>

              <button
                type="button"
                onClick={() => {
                  setAlertsFocusMode(
                    "active-critical",
                  );
                  alertsSectionRef.current?.scrollIntoView(
                    {
                      behavior: "smooth",
                      block: "start",
                    },
                  );
                }}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                View alerts
              </button>
            </div>
          </div>

          {isCriticalBannerPreviewUnavailable ? (
            <p className="mt-3 text-xs text-red-200/80">
              Critical alert details are
              temporarily unavailable.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Router"
          value={
            overview
              ? overview.router.is_healthy
                ? "Reachable"
                : "Down"
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `Latency ${formatMs(overview.router.latest_latency_ms)}`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="Internet"
          value={
            overview
              ? overview.internet.is_healthy
                ? "Online"
                : "Offline"
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `Latency ${formatMs(overview.internet.latest_latency_ms)}`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="DNS"
          value={
            overview
              ? overview.dns.is_healthy
                ? "Healthy"
                : "Unhealthy"
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `Response ${formatMs(overview.dns.latest_response_time_ms)}`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="24h Uptime"
          value={
            summary
              ? `${summary.uptime_pct_24h.toFixed(1)}%`
              : summaryQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            summary
              ? `${summary.outage_count_24h} outages`
              : summaryQuery.isError
                ? "Summary unavailable"
                : "Waiting for summary data"
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Router status
            </h3>
            {overview ? (
              <StatusBadge
                ok={overview.router.is_healthy}
                activeOutage={
                  overview.router.active_outage
                }
              />
            ) : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>
              Last success:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.router
                    .last_success_at,
                )}
              </span>
            </p>
            <p>
              Last failure:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.router
                    .last_failure_at,
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Internet status
            </h3>
            {overview ? (
              <StatusBadge
                ok={overview.internet.is_healthy}
                activeOutage={
                  overview.internet.active_outage
                }
              />
            ) : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>
              Last success:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.internet
                    .last_success_at,
                )}
              </span>
            </p>
            <p>
              Last failure:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.internet
                    .last_failure_at,
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              DNS status
            </h3>
            {overview ? (
              <StatusBadge
                ok={overview.dns.is_healthy}
                activeOutage={
                  overview.dns.active_outage
                }
              />
            ) : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>
              Last success:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.dns.last_success_at,
                )}
              </span>
            </p>
            <p>
              Last failure:{" "}
              <span className="text-zinc-400">
                {formatDate(
                  overview?.dns.last_failure_at,
                )}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Active outages"
          value={
            overview
              ? String(
                  overview.outages.active_count,
                )
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `${overview.outages.last_24h_count} in last 24h`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="Devices seen (24h)"
          value={
            overview
              ? String(
                  overview.devices
                    .active_count_24h,
                )
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `Last seen ${formatDate(overview.devices.most_recent_seen_at)}`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="Active alerts"
          value={
            overview
              ? String(
                  overview.alerts.active_count,
                )
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overview
              ? `${overview.alerts.active_unacknowledged_count} unacknowledged · ${overview.alerts.active_critical_count} critical`
              : "Waiting for overview data"
          }
        />
        <StatCard
          label="Last overall check"
          value={
            overview
              ? formatDate(overview.checked_at)
              : overviewQuery.isLoading
                ? "Loading"
                : "—"
          }
          hint={
            overviewQuery.isError
              ? "Overview unavailable"
              : undefined
          }
        />
      </section>

      <div
        ref={alertsSectionRef}
        className="grid gap-4 lg:grid-cols-2"
      >
        <IssuePanel issues={issues} />
        <AlertsPanel
          focusMode={alertsFocusMode}
        />
      </div>
    </div>
  );
}
