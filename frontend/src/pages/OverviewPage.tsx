import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AlertsPanel from "../components/AlertsPanel";
import DebugPanel from "../components/DebugPanel";
import IssuePanel from "../components/IssuePanel";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";
import {
  buildAlertHeadline,
  buildAlertSubtext,
  formatIncidentType,
} from "../utils/incidentText";

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

function formatRssi(value?: number | null) {
  if (value === null || value === undefined)
    return "—";
  return `${value} dBm`;
}

function formatMinutesAgo(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(
    0,
    Math.floor(diffMs / 60000),
  );

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  return `${diffMinutes} minutes ago`;
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (
    size >= 1024 &&
    unitIndex < units.length - 1
  ) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatInterfaceName(
  value?: string | null,
) {
  if (!value) return "—";
  return value;
}

function getWeakestWifiRoom(
  items: Array<{
    location_label: string;
    latest_sample?: {
      rssi_dbm?: number | null;
      sampled_at: string;
      ssid?: string | null;
      band?: string | null;
    } | null;
  }>,
) {
  return [...items]
    .filter(
      (item) =>
        item.latest_sample?.rssi_dbm !== null &&
        item.latest_sample?.rssi_dbm !==
          undefined,
    )
    .sort(
      (a, b) =>
        (a.latest_sample?.rssi_dbm ?? 0) -
        (b.latest_sample?.rssi_dbm ?? 0),
    )[0];
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
  const navigate = useNavigate();

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

  const wifiSummaryQuery = useQuery({
    queryKey: ["wifi-location-summaries", 60],
    queryFn: () =>
      api.getWifiLocationSummaries({
        minutes: 60,
      }),
    refetchInterval: 30000,
    retry: false,
  });

  const wifiAlertsQuery = useQuery({
    queryKey: ["alerts", "active", "wifi"],
    queryFn: () =>
      api.getAlerts({
        status: "active",
        entity_type: "wifi",
        limit: 200,
      }),
    refetchInterval: 30000,
    retry: false,
  });

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
    staleTime: 0,
    refetchInterval: 15000,
  });

  const trafficSummaryQuery = useQuery({
    queryKey: ["traffic-summary", 60],
    queryFn: () => api.getTrafficSummary(60),
  });

  const overview = overviewQuery.data;
  const summary = summaryQuery.data;
  const trafficSummary = trafficSummaryQuery.data;

  const wifiSummaryItems =
    wifiSummaryQuery.data?.items ?? [];

  const activeWifiAlerts =
    wifiAlertsQuery.data ?? [];

  const weakestWifiRoom = getWeakestWifiRoom(
    wifiSummaryItems,
  );

  const weakestWifiRoomActiveAlert =
    weakestWifiRoom
      ? (activeWifiAlerts.find(
          (alert) =>
            alert.entity_key ===
            weakestWifiRoom.location_label,
        ) ?? null)
      : null;

  const wifiFreshRooms = wifiSummaryItems.filter(
    (item) => item.latest_sample,
  ).length;

  const wifiStaleRooms = wifiSummaryItems.filter(
    (item) => !item.latest_sample,
  ).length;

  const alertsSectionRef =
    useRef<HTMLDivElement | null>(null);

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
      title: "Router issue detected",
      detail:
        overview.router.latest_error_message ??
        "Router reachability is failing.",
    });
  }
  if (overview && !overview.internet.is_healthy) {
    issues.push({
      title: "Internet issue detected",
      detail:
        overview.internet.latest_error_message ??
        "Internet connectivity is failing.",
    });
  }
  if (overview && !overview.dns.is_healthy) {
    issues.push({
      title: "DNS issue detected",
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
    {
      name: "/api/wifi/locations/summary",
      ...(wifiSummaryQuery.isLoading
        ? {
            status: "loading" as const,
            detail:
              "Waiting for Wi-Fi room summaries",
          }
        : wifiSummaryQuery.isError
          ? {
              status: "error" as const,
              detail:
                "Wi-Fi summary request failed",
            }
          : wifiSummaryItems.length > 0
            ? {
                status: "ok" as const,
                detail: `${wifiSummaryItems.length} Wi-Fi rooms summarized`,
              }
            : {
                status: "ok" as const,
                detail:
                  "No Wi-Fi room summaries yet",
              }),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              Overview
            </h2>
            <p className="mt-2 text-zinc-400">
              Current network health, active
              incidents, and the next signals
              worth reviewing.
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
        <section className="rounded-2xl border border-red-900 bg-red-950/40 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-red-300">
                Immediate attention needed
              </h3>

              {topCriticalAlert ? (
                <>
                  <p className="mt-1 text-base font-medium text-zinc-100">
                    {buildAlertHeadline({
                      entityType:
                        topCriticalAlert.entity_type,
                      entityKey:
                        topCriticalAlert.entity_key,
                      message:
                        topCriticalAlert.message,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {
                      buildAlertSubtext({
                        entityType:
                          topCriticalAlert.entity_type,
                        entityKey:
                          topCriticalAlert.entity_key,
                        message:
                          topCriticalAlert.message,
                      }).targetLabel
                    }
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatIncidentType(
                      topCriticalAlert.entity_type,
                    )}{" "}
                    · Opened{" "}
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

            <div className="flex flex-wrap items-center gap-3">
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
                Review alerts
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

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Attention now
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            The fastest read on current service
            health and incident pressure.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                ? `Latency ${formatMs(
                    overview.router
                      .latest_latency_ms,
                  )}`
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
                ? `Latency ${formatMs(
                    overview.internet
                      .latest_latency_ms,
                  )}`
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
                ? `Response ${formatMs(
                    overview.dns
                      .latest_response_time_ms,
                  )}`
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
        </div>

        <div className="pt-1">
          <h4 className="text-base font-medium text-zinc-100">
            Activity snapshot
          </h4>
          <p className="mt-1 text-sm text-zinc-400">
            Recent activity, outage pressure, and
            latest dashboard refresh context.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ongoing outages"
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
                ? `Last seen ${formatDate(
                    overview.devices
                      .most_recent_seen_at,
                  )}`
                : "Waiting for overview data"
            }
          />

          <StatCard
            label="Traffic (1h)"
            value={
              trafficSummary
                ? formatBytes(
                    trafficSummary.total_bytes,
                  )
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint={
              trafficSummary
                ? `${trafficSummary.interface_count} interface${
                    trafficSummary.interface_count ===
                    1
                      ? ""
                      : "s"
                  } observed`
                : trafficSummaryQuery.isError
                  ? "Traffic summary unavailable"
                  : "Waiting for traffic data"
            }
          />

          <StatCard
            label="Top talker"
            value={
              trafficSummary?.top_talker
                ? formatInterfaceName(
                    trafficSummary.top_talker
                      .interface_name,
                  )
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint={
              trafficSummary?.top_talker
                ? `${formatBytes(
                    trafficSummary.top_talker
                      .delta_bytes_total,
                  )} moved in last hour`
                : trafficSummaryQuery.isError
                  ? "Top talker unavailable"
                  : "Waiting for traffic data"
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
                : "Latest overview refresh"
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Current network state
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Latest probe health for router
            reachability, internet access, and
            DNS.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Router
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
              <p>
                Latest latency:{" "}
                <span className="text-zinc-400">
                  {formatMs(
                    overview?.router
                      .latest_latency_ms,
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Internet
              </h3>
              {overview ? (
                <StatusBadge
                  ok={
                    overview.internet.is_healthy
                  }
                  activeOutage={
                    overview.internet
                      .active_outage
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
              <p>
                Latest latency:{" "}
                <span className="text-zinc-400">
                  {formatMs(
                    overview?.internet
                      .latest_latency_ms,
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                DNS
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
              <p>
                Latest response:{" "}
                <span className="text-zinc-400">
                  {formatMs(
                    overview?.dns
                      .latest_response_time_ms,
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Wi-Fi health
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Fast read on room-level Wi-Fi signal
            quality and sample freshness from the
            last hour.
          </p>
        </div>

        {wifiSummaryQuery.isLoading ? (
          <QueryState
            title="Wi-Fi health loading"
            message="Waiting for Wi-Fi room summaries."
          />
        ) : wifiSummaryQuery.isError ? (
          <QueryState
            title="Wi-Fi request failed"
            tone="error"
            message="Wi-Fi room summaries could not be loaded."
          />
        ) : wifiSummaryItems.length === 0 ? (
          <QueryState
            title="No Wi-Fi summaries yet"
            tone="warning"
            message="Wi-Fi sampling has not produced room summaries yet."
          />
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-base font-medium text-zinc-100">
                  {weakestWifiRoom
                    ? `Weakest room: ${weakestWifiRoom.location_label}`
                    : "Wi-Fi room summary"}
                </h4>
                <p className="mt-1 text-sm text-zinc-400">
                  {weakestWifiRoom?.latest_sample
                    ?.ssid
                    ? `${weakestWifiRoom.latest_sample.ssid} · sampled ${formatMinutesAgo(
                        weakestWifiRoom
                          .latest_sample
                          .sampled_at,
                      )}`
                    : "Room summaries available"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {weakestWifiRoom?.latest_sample
                  ?.band ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    {
                      weakestWifiRoom
                        .latest_sample.band
                    }
                  </span>
                ) : null}

                {weakestWifiRoom ? (
                  <button
                    type="button"
                    onClick={() => {
                      const params =
                        new URLSearchParams({
                          location:
                            weakestWifiRoom.location_label,
                          minutes: "60",
                        });

                      if (
                        weakestWifiRoomActiveAlert?.id
                      ) {
                        params.set(
                          "alert",
                          String(
                            weakestWifiRoomActiveAlert.id,
                          ),
                        );
                      }

                      navigate(
                        `/wifi?${params.toString()}`,
                      );
                    }}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    Open weakest room
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    navigate("/wifi")
                  }
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Open Wi-Fi page
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Weakest signal"
                value={formatRssi(
                  weakestWifiRoom?.latest_sample
                    ?.rssi_dbm,
                )}
                hint={
                  weakestWifiRoom
                    ? weakestWifiRoom.location_label
                    : "No RSSI available"
                }
              />

              <StatCard
                label="Rooms reporting"
                value={String(wifiFreshRooms)}
                hint={`${wifiSummaryItems.length} total rooms`}
              />

              <StatCard
                label="Stale rooms"
                value={String(wifiStaleRooms)}
                hint="No sample in current window"
              />

              <StatCard
                label="Latest Wi-Fi refresh"
                value={
                  weakestWifiRoom?.latest_sample
                    ?.sampled_at
                    ? formatMinutesAgo(
                        weakestWifiRoom
                          .latest_sample
                          .sampled_at,
                      )
                    : "—"
                }
                hint="Latest weakest-room sample"
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Take action
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Review active issues and work through
            alerts that need action.
          </p>
        </div>

        <div
          ref={alertsSectionRef}
          className="grid gap-4 lg:grid-cols-2"
        >
          <IssuePanel issues={issues} />
          <AlertsPanel
            focusMode={alertsFocusMode}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            API diagnostics
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Lower-priority API request visibility
            for local troubleshooting.
          </p>
        </div>

        <DebugPanel endpoints={endpoints} />
      </section>
    </div>
  );
}
