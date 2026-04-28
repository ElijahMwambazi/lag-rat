import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import StateCard from "../components/StateCard";
import AlertDetailDrawer from "../components/alerts/AlertDetailDrawer";
import WifiSampleDetailDrawer from "../components/WifiSampleDetailDrawer";
import DataTableCard from "../components/DataTableCard";
import CollapsibleInspectionSection from "../components/CollapsibleInspectionSection";
import DrawerDetailSection from "../components/DrawerDetailSection";
import PageFilterBar from "../components/PageFilterBar";
import InspectionHighlightCard from "../components/InspectionHighlightCard";
import {
  api,
  type Alert,
  type AlertHistoryItem,
  type WifiLocationSummariesResponse,
  type WifiLocationsResponse,
  type WifiSample,
  type WifiSummaryResponse,
} from "../services/api";

type WindowOption = {
  label: string;
  minutes: number;
};

type RoomHealthTone = "healthy" | "warning" | "critical" | "stale";

const WINDOWS: WindowOption[] = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 60 * 6 },
  { label: "24h", minutes: 60 * 24 },
  { label: "7d", minutes: 60 * 24 * 7 },
];

function formatWindowLabel(minutes: number) {
  const match = WINDOWS.find((option) => option.minutes === minutes);
  return match?.label ?? `${minutes}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function formatRssi(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value} dBm`;
}

function formatSampleAge(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

function getRoomStatusDescription(tone: RoomHealthTone) {
  switch (tone) {
    case "healthy":
      return "No active Wi-Fi alerts for this room.";
    case "warning":
      return "Signal is weak for this room. Check placement, interference, or distance from the router.";
    case "critical":
      return "Wi-Fi health is critical for this room. Investigate signal quality and recent environmental changes.";
    case "stale":
      return "Wi-Fi sampling is stale for this room. Collector data may no longer be arriving.";
  }
}

function getRoomStatusBadgeClasses(tone: RoomHealthTone) {
  switch (tone) {
    case "healthy":
      return "border-emerald-900 bg-emerald-950/40 text-emerald-300";
    case "warning":
      return "border-amber-900 bg-amber-950/40 text-amber-300";
    case "critical":
      return "border-red-900 bg-red-950/40 text-red-300";
    case "stale":
      return "border-orange-900 bg-orange-950/40 text-orange-300";
  }
}

function SelectionBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "rounded-full border px-2 py-0.5 text-[11px]",
        active
          ? "border-zinc-600 bg-zinc-800 text-zinc-100"
          : "border-transparent bg-transparent text-transparent",
      ].join(" ")}
      aria-hidden={!active}
    >
      {active ? "Selected" : "\u00A0"}
    </span>
  );
}

function getRoomHealthStatus(
  alerts: Alert[],
  location: string,
): {
  label: string;
  tone: RoomHealthTone;
} {
  const roomAlerts = alerts.filter(
    (alert) =>
      alert.is_active &&
      alert.entity_type === "wifi" &&
      alert.entity_key === location,
  );

  if (
    roomAlerts.some(
      (alert) =>
        alert.alert_type === "wifi_samples_stale" &&
        alert.severity === "critical",
    )
  ) {
    return { label: "Stale", tone: "critical" };
  }

  if (roomAlerts.some((alert) => alert.alert_type === "wifi_samples_stale")) {
    return { label: "Stale", tone: "stale" };
  }

  if (
    roomAlerts.some(
      (alert) =>
        alert.alert_type === "wifi_signal_weak" &&
        alert.severity === "critical",
    )
  ) {
    return {
      label: "Critical",
      tone: "critical",
    };
  }

  if (roomAlerts.some((alert) => alert.alert_type === "wifi_signal_weak")) {
    return { label: "Weak", tone: "warning" };
  }

  return { label: "Healthy", tone: "healthy" };
}

function getRoomCardClasses(active: boolean) {
  return [
    "rounded-2xl border p-4 text-left transition-colors",
    active
      ? "border-zinc-500 bg-zinc-800/80"
      : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60",
  ].join(" ");
}

function getViewingLabel(locationLabel: string) {
  return locationLabel || "All locations";
}

function getRecentSamplesTitle(locationLabel: string) {
  return locationLabel ? `Recent samples · ${locationLabel}` : "Recent samples";
}

function getWifiSampleDisplayTitle(sample: WifiSample | null) {
  if (!sample) return "Wi-Fi sample";

  return sample.location_label
    ? `Wi-Fi sample · ${sample.location_label}`
    : "Wi-Fi sample";
}

function getWifiSampleStatusTone(sample: WifiSample): RoomHealthTone {
  if (sample.rssi_dbm === null || sample.rssi_dbm === undefined) {
    return "stale";
  }

  if (sample.rssi_dbm <= -75) {
    return "critical";
  }

  if (sample.rssi_dbm <= -67) {
    return "warning";
  }

  return "healthy";
}

function getWifiSampleStatusLabel(sample: WifiSample) {
  const tone = getWifiSampleStatusTone(sample);

  switch (tone) {
    case "critical":
      return "Poor";
    case "warning":
      return "Weak";
    case "stale":
      return "Unknown";
    case "healthy":
    default:
      return "Healthy";
  }
}

function getWifiSampleNarrative(sample: WifiSample) {
  const tone = getWifiSampleStatusTone(sample);

  switch (tone) {
    case "critical":
      return "Signal quality is poor for this sample and likely to impact stability or throughput.";
    case "warning":
      return "Signal quality is weaker than ideal for this sample and may need attention.";
    case "stale":
      return "Signal quality could not be interpreted from this sample.";
    case "healthy":
    default:
      return "Signal quality looks healthy for this sample.";
  }
}

function formatTimelineEventTitle(eventType: string) {
  switch (eventType) {
    case "opened":
      return "Opened";
    case "severity_changed":
      return "Severity changed";
    case "message_changed":
      return "Message updated";
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function formatTimelineEventDetail(event: {
  event_type: string;
  previous_value?: string | null;
  new_value?: string | null;
}) {
  if (
    event.event_type === "severity_changed" &&
    event.previous_value &&
    event.new_value
  ) {
    return `${event.previous_value} → ${event.new_value}`;
  }

  if (event.event_type === "opened" && event.new_value) {
    return `Severity set to ${event.new_value}`;
  }

  if (event.previous_value && event.new_value) {
    return `${event.previous_value} → ${event.new_value}`;
  }

  if (event.new_value) return event.new_value;
  if (event.previous_value) return event.previous_value;

  return null;
}

function getRecoverySeverityLabel(alert: Alert) {
  return alert.severity || "unknown";
}

function WifiMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <p className="mt-3 text-sm text-zinc-400">{hint}</p>
    </div>
  );
}

export default function WifiPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMinutesParam = Number(searchParams.get("minutes") ?? "60");

  const initialWindowMinutes = WINDOWS.some(
    (option) => option.minutes === initialMinutesParam,
  )
    ? initialMinutesParam
    : 60;

  const initialLocationLabel = searchParams.get("location") ?? "";
  const initialAlertIdParam = Number(searchParams.get("alert") ?? "");
  const initialAlertId = Number.isFinite(initialAlertIdParam)
    ? initialAlertIdParam
    : null;

  const [windowMinutes, setWindowMinutes] = useState(initialWindowMinutes);
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [drawerAlertId, setDrawerAlertId] = useState<number | null>(
    initialAlertId,
  );
  const [selectedSample, setSelectedSample] = useState<WifiSample | null>(null);
  const [sampleDrawerOpen, setSampleDrawerOpen] = useState(false);
  const [samplesCollapsed, setSamplesCollapsed] = useState(true);

  const queryClient = useQueryClient();

  const locationsQuery = useQuery<WifiLocationsResponse>({
    queryKey: ["wifi-locations"],
    queryFn: api.getWifiLocations,
    refetchInterval: 30000,
  });

  const summaryQuery = useQuery<WifiSummaryResponse>({
    queryKey: ["wifi-summary", windowMinutes, locationLabel],
    queryFn: () =>
      api.getWifiSummary({
        minutes: windowMinutes,
        location_label: locationLabel || undefined,
      }),
    refetchInterval: 30000,
  });

  const samplesQuery = useQuery<WifiSample[]>({
    queryKey: ["wifi-samples", windowMinutes, locationLabel],
    queryFn: () =>
      api.getWifiSamples({
        minutes: windowMinutes,
        location_label: locationLabel || undefined,
        limit: 200,
      }),
    refetchInterval: 30000,
  });

  const latestSample = summaryQuery.data?.latest_sample ?? null;

  const locationOptions: string[] = locationsQuery.data?.items ?? [];

  const locationSummariesQuery = useQuery<WifiLocationSummariesResponse>({
    queryKey: ["wifi-location-summaries", windowMinutes],
    queryFn: () =>
      api.getWifiLocationSummaries({
        minutes: windowMinutes,
      }),
    refetchInterval: 30000,
  });

  const roomComparisonItems = locationSummariesQuery.data?.items ?? [];

  const wifiSamples: WifiSample[] = samplesQuery.data ?? [];

  const wifiAlertsQuery = useQuery<Alert[]>({
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

  const activeWifiAlerts = wifiAlertsQuery.data ?? [];

  const selectedRoomAlerts = locationLabel
    ? activeWifiAlerts
        .filter(
          (alert) =>
            alert.is_active &&
            alert.entity_type === "wifi" &&
            alert.entity_key === locationLabel,
        )
        .sort((a, b) => {
          const severityRank = {
            critical: 2,
            warning: 1,
            info: 0,
          } as const;

          const severityDiff =
            (severityRank[b.severity as keyof typeof severityRank] ?? 0) -
            (severityRank[a.severity as keyof typeof severityRank] ?? 0);

          if (severityDiff !== 0) {
            return severityDiff;
          }

          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        })
    : [];

  const selectedRoomPrimaryAlert = selectedRoomAlerts[0] ?? null;

  const selectedRoomStatus = locationLabel
    ? getRoomHealthStatus(activeWifiAlerts, locationLabel)
    : null;

  const selectedRoomHistoryQuery = useQuery<AlertHistoryItem[]>({
    queryKey: ["alert-history", selectedRoomPrimaryAlert?.id],
    queryFn: () => api.getAlertHistory(selectedRoomPrimaryAlert!.id),
    enabled: !!selectedRoomPrimaryAlert,
    refetchInterval: 30000,
    retry: false,
  });

  const acknowledgeWifiAlertMutation = useMutation({
    mutationFn: (id: number) => api.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts", "active", "wifi"],
      });
      queryClient.invalidateQueries({
        queryKey: ["alert-history", selectedRoomPrimaryAlert?.id],
      });
    },
  });

  const canAcknowledgeSelectedRoomAlert =
    !!selectedRoomPrimaryAlert &&
    selectedRoomPrimaryAlert.is_active &&
    !selectedRoomPrimaryAlert.acknowledged_at;

  const selectedRoomAlertAcknowledged =
    !!selectedRoomPrimaryAlert?.acknowledged_at;

  const selectedRoomResolvedAlertsQuery = useQuery<Alert[]>({
    queryKey: ["alerts", "resolved", "wifi", locationLabel],
    queryFn: () =>
      api.getAlerts({
        status: "resolved",
        entity_type: "wifi",
        limit: 50,
      }),
    enabled: !!locationLabel,
    refetchInterval: 30000,
    retry: false,
  });

  const selectedRoomResolvedAlertsAll = (
    selectedRoomResolvedAlertsQuery.data ?? []
  )
    .filter((alert) => alert.entity_key === locationLabel)
    .sort(
      (a, b) =>
        new Date(b.resolved_at ?? b.created_at).getTime() -
        new Date(a.resolved_at ?? a.created_at).getTime(),
    );

  const selectedRoomResolvedAlerts = selectedRoomResolvedAlertsAll.slice(0, 3);

  const [recoveryDrawerAlert, setRecoveryDrawerAlert] = useState<Alert | null>(
    null,
  );

  const recoveryAlertHistoryQuery = useQuery<AlertHistoryItem[]>({
    queryKey: ["alert-history", recoveryDrawerAlert?.id],
    queryFn: () => api.getAlertHistory(recoveryDrawerAlert!.id),
    enabled: !!recoveryDrawerAlert,
    refetchInterval: 30000,
    retry: false,
  });

  const drawerAlert =
    selectedRoomPrimaryAlert?.id === drawerAlertId
      ? selectedRoomPrimaryAlert
      : (selectedRoomResolvedAlertsAll.find(
          (alert) => alert.id === drawerAlertId,
        ) ?? null);

  const wifiChartData = useMemo(
    () =>
      wifiSamples
        .filter(
          (sample) => sample.rssi_dbm !== null && sample.rssi_dbm !== undefined,
        )
        .map((sample) => ({
          timestamp: sample.sampled_at,
          value: sample.rssi_dbm as number,
        })),
    [wifiSamples],
  );

  function updateSearchParams(next: {
    minutes: number;
    location: string;
    alertId?: number | null;
  }) {
    const params = new URLSearchParams();

    if (next.location) {
      params.set("location", next.location);
    }

    if (next.minutes !== 60) {
      params.set("minutes", String(next.minutes));
    }

    if (next.alertId) {
      params.set("alert", String(next.alertId));
    }

    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    if (!drawerAlertId) return;

    if (selectedRoomPrimaryAlert?.id === drawerAlertId) {
      setRecoveryDrawerAlert(null);
      setAlertDrawerOpen(true);
      return;
    }

    const resolvedMatch =
      selectedRoomResolvedAlertsAll.find(
        (alert) => alert.id === drawerAlertId,
      ) ?? null;

    if (resolvedMatch) {
      setRecoveryDrawerAlert(resolvedMatch);
      setAlertDrawerOpen(false);
      return;
    }

    setAlertDrawerOpen(false);
    setRecoveryDrawerAlert(null);
  }, [drawerAlertId, selectedRoomPrimaryAlert, selectedRoomResolvedAlertsAll]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageFilterBar
        title="Wi-Fi"
        description="Room-based Wi-Fi summaries, comparisons, and recent samples across the selected operational window."
        controls={
          <>
            <select
              value={windowMinutes}
              onChange={(e) => {
                const nextMinutes = Number(e.target.value);

                setWindowMinutes(nextMinutes);
                setDrawerAlertId(null);
                setAlertDrawerOpen(false);
                setRecoveryDrawerAlert(null);

                updateSearchParams({
                  minutes: nextMinutes,
                  location: locationLabel,
                  alertId: null,
                });
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 sm:w-auto"
            >
              <option value={15}>Last 15m</option>
              <option value={60}>Last 1h</option>
              <option value={360}>Last 6h</option>
              <option value={1440}>Last 24h</option>
            </select>

            <select
              value={locationLabel}
              onChange={(e) => {
                const nextLocation = e.target.value;
                setLocationLabel(nextLocation);
                setDrawerAlertId(null);
                setAlertDrawerOpen(false);
                setRecoveryDrawerAlert(null);

                updateSearchParams({
                  minutes: windowMinutes,
                  location: nextLocation,
                  alertId: null,
                });
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 sm:w-auto"
            >
              <option value="">All locations</option>
              {locationOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </>
        }
      >
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
          Last {formatWindowLabel(windowMinutes)}
        </span>

        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
          {locationLabel
            ? `Viewing · ${locationLabel}`
            : "Viewing · All locations"}
        </span>
      </PageFilterBar>

      {summaryQuery.isError ? (
        <QueryState
          title="Wi-Fi summary request failed"
          tone="error"
          message={
            summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : "The Wi-Fi summary could not be loaded."
          }
        />
      ) : null}

      {samplesQuery.isError ? (
        <QueryState
          title="Wi-Fi samples request failed"
          tone="error"
          message={
            samplesQuery.error instanceof Error
              ? samplesQuery.error.message
              : "The Wi-Fi sample history could not be loaded."
          }
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-medium">Room comparison</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Compare the latest sampled Wi-Fi state by location and jump
              directly into a room.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Viewing: {getViewingLabel(locationLabel)}
            </span>

            {locationLabel ? (
              <button
                type="button"
                onClick={() => {
                  setLocationLabel("");
                  setDrawerAlertId(null);
                  setAlertDrawerOpen(false);
                  setRecoveryDrawerAlert(null);

                  updateSearchParams({
                    minutes: windowMinutes,
                    location: "",
                    alertId: null,
                  });
                }}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                Clear room filter
              </button>
            ) : null}
          </div>
        </div>

        {(locationsQuery.isLoading || locationSummariesQuery.isLoading) &&
        locationOptions.length === 0 ? (
          <QueryState
            title="Room comparison"
            message="Loading Wi-Fi locations..."
          />
        ) : locationSummariesQuery.isError ? (
          <QueryState
            title="Room comparison"
            tone="error"
            message={
              locationSummariesQuery.error instanceof Error
                ? locationSummariesQuery.error.message
                : "Room summaries could not be loaded."
            }
          />
        ) : locationOptions.length === 0 ? (
          <QueryState
            title="Room comparison"
            tone="warning"
            message="No Wi-Fi locations have been recorded yet."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                setLocationLabel("");
                setDrawerAlertId(null);
                setAlertDrawerOpen(false);
                setRecoveryDrawerAlert(null);

                updateSearchParams({
                  minutes: windowMinutes,
                  location: "",
                  alertId: null,
                });
              }}
              className={getRoomCardClasses(locationLabel === "")}
            >
              <div className="flex min-h-[88px] items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-sm font-medium text-zinc-100">
                    All locations
                  </div>
                  <p className="mt-1 min-h-[36px] text-xs leading-5 text-zinc-500">
                    Combined Wi-Fi view across recorded rooms
                  </p>
                </div>

                <div className="flex min-h-[44px] shrink-0 flex-col items-end gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                    {locationOptions.length} rooms
                  </span>
                  <SelectionBadge active={locationLabel === ""} />
                </div>
              </div>
            </button>

            {roomComparisonItems.map((item) => {
              const location = item.location_label;
              const latest = item.latest_sample ?? null;
              const isActive = locationLabel === location;

              const roomHealth = getRoomHealthStatus(
                activeWifiAlerts,
                location,
              );

              return (
                <InspectionHighlightCard
                  key={location}
                  onClick={() => {
                    setLocationLabel(location);
                    setDrawerAlertId(null);
                    setAlertDrawerOpen(false);
                    setRecoveryDrawerAlert(null);

                    updateSearchParams({
                      minutes: windowMinutes,
                      location,
                      alertId: null,
                    });
                  }}
                  className={
                    isActive
                      ? "border-zinc-500 bg-zinc-800/80"
                      : "hover:bg-zinc-800/60"
                  }
                  title={location}
                  subtitle={latest?.ssid ?? "SSID unavailable"}
                  statusLabel={roomHealth.label}
                  statusBadgeClassName={getRoomStatusBadgeClasses(
                    roomHealth.tone,
                  )}
                  primaryLabel="Latest RSSI"
                  primaryValue={latest ? formatRssi(latest.rssi_dbm) : "—"}
                  metrics={[
                    {
                      label: "Band",
                      value: latest?.band ?? "—",
                    },
                    {
                      label: "Samples",
                      value: String(item.sample_count),
                    },
                  ]}
                  footerLabel="Sampled"
                  footerValue={
                    latest
                      ? `Sampled ${formatSampleAge(latest.sampled_at)}`
                      : "No Wi-Fi sample in this window"
                  }
                  actionHint={isActive ? "Selected room" : "Filter room"}
                >
                  <div className="flex justify-end">
                    <SelectionBadge active={isActive} />
                  </div>
                </InspectionHighlightCard>
              );
            })}
          </div>
        )}
      </section>

      {locationLabel ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium">Selected room status</h3>

                  {selectedRoomStatus ? (
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs",
                        getRoomStatusBadgeClasses(selectedRoomStatus.tone),
                      ].join(" ")}
                    >
                      {selectedRoomStatus.label}
                    </span>
                  ) : null}

                  {selectedRoomAlertAcknowledged ? (
                    <span className="rounded-full border border-amber-800 bg-amber-950 px-3 py-1 text-xs text-amber-300">
                      Acknowledged
                    </span>
                  ) : null}

                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                    Last {formatWindowLabel(windowMinutes)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-zinc-400">
                  Current health interpretation for {locationLabel}.
                </p>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Current assessment
                  </div>

                  <div className="mt-3 text-base font-medium text-zinc-100">
                    {selectedRoomPrimaryAlert?.message ??
                      "No active Wi-Fi alerts for this room."}
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    {selectedRoomStatus
                      ? getRoomStatusDescription(selectedRoomStatus.tone)
                      : "No current room status available."}
                  </p>

                  {acknowledgeWifiAlertMutation.isError ? (
                    <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                      {acknowledgeWifiAlertMutation.error instanceof Error
                        ? acknowledgeWifiAlertMutation.error.message
                        : "Could not acknowledge alert."}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  {canAcknowledgeSelectedRoomAlert ? (
                    <button
                      type="button"
                      disabled={acknowledgeWifiAlertMutation.isPending}
                      onClick={() =>
                        acknowledgeWifiAlertMutation.mutate(
                          selectedRoomPrimaryAlert.id,
                        )
                      }
                      className="rounded-lg border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-300 hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {acknowledgeWifiAlertMutation.isPending
                        ? "Acknowledging..."
                        : "Acknowledge alert"}
                    </button>
                  ) : null}

                  {selectedRoomPrimaryAlert ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryDrawerAlert(null);
                        setDrawerAlertId(selectedRoomPrimaryAlert.id);
                        setAlertDrawerOpen(true);
                        updateSearchParams({
                          minutes: windowMinutes,
                          location: locationLabel,
                          alertId: selectedRoomPrimaryAlert.id,
                        });
                      }}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      View alert details
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DrawerDetailSection label="Sample age">
                <div className="text-sm font-medium text-zinc-100">
                  {formatSampleAge(latestSample?.sampled_at)}
                </div>
              </DrawerDetailSection>

              <DrawerDetailSection label="Latest signal">
                <div className="text-sm font-medium text-zinc-100">
                  {formatRssi(latestSample?.rssi_dbm)}
                </div>
              </DrawerDetailSection>

              <DrawerDetailSection label="Link details">
                <div className="text-sm font-medium text-zinc-100">
                  {latestSample?.band ?? "—"}
                  {latestSample?.frequency_mhz != null
                    ? ` · ${latestSample.frequency_mhz} MHz`
                    : ""}
                </div>
              </DrawerDetailSection>

              <DrawerDetailSection label="Samples in window">
                <div className="text-sm font-medium text-zinc-100">
                  {summaryQuery.data?.sample_count ?? 0}
                </div>
              </DrawerDetailSection>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-medium">
                    Room incident timeline
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Recent Wi-Fi incident events for {locationLabel}.
                  </p>
                </div>

                {selectedRoomPrimaryAlert ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                      Alert #{selectedRoomPrimaryAlert.id}
                    </span>

                    {selectedRoomAlertAcknowledged ? (
                      <span className="rounded-full border border-amber-800 bg-amber-950 px-3 py-1 text-xs text-amber-300">
                        Acknowledged
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!selectedRoomPrimaryAlert ? (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="text-sm text-zinc-400">
                    No active Wi-Fi incident timeline for this room.
                  </div>
                </div>
              ) : selectedRoomHistoryQuery.isLoading ? (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="text-sm text-zinc-400">
                    Loading room incident history...
                  </div>
                </div>
              ) : selectedRoomHistoryQuery.isError ? (
                <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-200">
                  <div className="text-sm">
                    Could not load room incident history.
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedRoomHistoryQuery.data
                    ?.slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .slice(0, 6)
                    .map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium text-zinc-100">
                            {formatTimelineEventTitle(event.event_type)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {formatDate(event.created_at)}
                          </div>
                        </div>

                        {formatTimelineEventDetail(event) ? (
                          <div className="mt-2 text-sm text-zinc-300">
                            {formatTimelineEventDetail(event)}
                          </div>
                        ) : null}

                        {event.event_type === "message_changed" &&
                        selectedRoomPrimaryAlert?.message ? (
                          <div className="mt-2 text-sm text-zinc-400">
                            {selectedRoomPrimaryAlert.message}
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-medium">Recent recoveries</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Recently resolved Wi-Fi incidents for {locationLabel}.
                  </p>
                </div>

                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                  {selectedRoomResolvedAlerts.length} recent
                </span>
              </div>

              {selectedRoomResolvedAlertsQuery.isLoading ? (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="text-sm text-zinc-400">
                    Loading recent recoveries...
                  </div>
                </div>
              ) : selectedRoomResolvedAlertsQuery.isError ? (
                <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-200">
                  <div className="text-sm">
                    Could not load recent recoveries.
                  </div>
                </div>
              ) : selectedRoomResolvedAlerts.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="text-sm text-zinc-400">
                    No recent recoveries for this room.
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedRoomResolvedAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setRecoveryDrawerAlert(alert);
                        setDrawerAlertId(alert.id);
                        setAlertDrawerOpen(false);
                        updateSearchParams({
                          minutes: windowMinutes,
                          location: locationLabel,
                          alertId: alert.id,
                        });
                      }}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-left transition-colors hover:bg-zinc-900/80"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                              Resolved
                            </span>
                            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                              {getRecoverySeverityLabel(alert)}
                            </span>
                          </div>

                          <div className="mt-3 text-sm font-medium text-zinc-100">
                            {alert.message}
                          </div>

                          <p className="mt-2 text-xs text-zinc-500">
                            Resolved {formatDate(alert.resolved_at)}
                          </p>
                        </div>

                        <span className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200">
                          View alert details
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <AlertDetailDrawer
                open={alertDrawerOpen}
                alert={selectedRoomPrimaryAlert}
                onClose={() => {
                  setAlertDrawerOpen(false);
                  setDrawerAlertId(null);
                  updateSearchParams({
                    minutes: windowMinutes,
                    location: locationLabel,
                    alertId: null,
                  });
                }}
                history={selectedRoomHistoryQuery.data ?? []}
                historyLoading={selectedRoomHistoryQuery.isLoading}
                historyError={selectedRoomHistoryQuery.isError}
                acknowledgePending={acknowledgeWifiAlertMutation.isPending}
                acknowledgeErrorMessage={
                  acknowledgeWifiAlertMutation.isError
                    ? acknowledgeWifiAlertMutation.error instanceof Error
                      ? acknowledgeWifiAlertMutation.error.message
                      : "Could not acknowledge alert."
                    : null
                }
                onAcknowledge={(id) => acknowledgeWifiAlertMutation.mutate(id)}
              />

              <AlertDetailDrawer
                open={!!recoveryDrawerAlert}
                alert={recoveryDrawerAlert}
                onClose={() => {
                  setRecoveryDrawerAlert(null);
                  setDrawerAlertId(null);
                  updateSearchParams({
                    minutes: windowMinutes,
                    location: locationLabel,
                    alertId: null,
                  });
                }}
                history={recoveryAlertHistoryQuery.data ?? []}
                historyLoading={recoveryAlertHistoryQuery.isLoading}
                historyError={recoveryAlertHistoryQuery.isError}
                acknowledgePending={false}
                acknowledgeErrorMessage={null}
                onAcknowledge={() => {}}
              />
            </section>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Performance snapshot</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Latest observed signal quality and radio details for the selected
            window.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryQuery.isLoading && !summaryQuery.data ? (
            <>
              <StateCard
                title="Latest signal"
                message="Loading Wi-Fi summary..."
              />
              <StateCard
                title="Average RSSI"
                message="Loading Wi-Fi summary..."
              />
              <StateCard title="Samples" message="Loading Wi-Fi summary..." />
              <StateCard title="Band" message="Loading Wi-Fi summary..." />
            </>
          ) : !summaryQuery.data || !latestSample ? (
            <>
              <StateCard
                title="Latest signal"
                tone="warning"
                message="No Wi-Fi samples found in this window."
              />
              <StateCard
                title="Average RSSI"
                tone="warning"
                message="No Wi-Fi samples found in this window."
              />
              <StateCard
                title="Samples"
                tone="warning"
                message="No Wi-Fi samples found in this window."
              />
              <StateCard
                title="Band"
                tone="warning"
                message="No Wi-Fi samples found in this window."
              />
            </>
          ) : (
            <>
              <WifiMetricCard
                label="Latest signal"
                value={formatRssi(latestSample.rssi_dbm)}
                hint={`${latestSample.location_label} · ${
                  latestSample.ssid ?? "Unknown SSID"
                }`}
              />

              <WifiMetricCard
                label="Average RSSI"
                value={
                  summaryQuery.data.avg_rssi_dbm != null
                    ? `${summaryQuery.data.avg_rssi_dbm.toFixed(1)} dBm`
                    : "—"
                }
                hint={`Min ${formatRssi(
                  summaryQuery.data.min_rssi_dbm,
                )} · Max ${formatRssi(summaryQuery.data.max_rssi_dbm)}`}
              />

              <WifiMetricCard
                label="Samples"
                value={String(summaryQuery.data.sample_count)}
                hint={`Sampled through ${formatDate(latestSample.sampled_at)}`}
              />

              <WifiMetricCard
                label="Band"
                value={latestSample.band ?? "—"}
                hint={
                  latestSample.frequency_mhz != null
                    ? `${latestSample.frequency_mhz} MHz`
                    : "Frequency unavailable"
                }
              />
            </>
          )}
        </section>
      </section>

      <ChartCard
        title={`Wi-Fi signal strength · Last ${formatWindowLabel(windowMinutes)}`}
        data={wifiChartData}
        isLoading={samplesQuery.isLoading}
        isError={samplesQuery.isError}
        errorMessage={
          samplesQuery.error instanceof Error
            ? samplesQuery.error.message
            : "Wi-Fi signal history request failed."
        }
        valueFormatter={(value) => `${value.toFixed(0)} dBm`}
        valueLabel="Signal"
      />

      <CollapsibleInspectionSection
        title={getRecentSamplesTitle(locationLabel)}
        description="Most recent Wi-Fi observations for the selected window."
        badges={
          <>
            {locationLabel ? (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                Filtered to {locationLabel}
              </span>
            ) : (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                All locations
              </span>
            )}

            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              {wifiSamples.length} sample
              {wifiSamples.length === 1 ? "" : "s"}
            </span>
          </>
        }
        collapsedSummary="Recent Wi-Fi samples are collapsed by default. Expand the table to inspect rows and open the sample detail drawer."
        collapsedDetail="Expand this table to inspect recent Wi-Fi samples and open row-level detail."
        collapsedActionLabel="Expand table"
        expandedActionLabel="Hide samples"
        isExpanded={
          !samplesCollapsed ||
          wifiSamples.length === 0 ||
          samplesQuery.isLoading ||
          samplesQuery.isError
        }
        onToggle={() => setSamplesCollapsed((current) => !current)}
      >
        <DataTableCard
          title={getRecentSamplesTitle(locationLabel)}
          description="Most recent Wi-Fi observations for the selected window."
          rightSlot={null}
          helperText="Swipe horizontally to inspect recent sample metadata across locations, SSIDs, signal levels, and radio bands."
          isLoading={samplesQuery.isLoading}
          isError={samplesQuery.isError}
          errorMessage={
            samplesQuery.error instanceof Error
              ? samplesQuery.error.message
              : "Sample history could not be loaded."
          }
          emptyTitle="Recent Wi-Fi samples"
          emptyMessage="No Wi-Fi samples were recorded in this window yet."
          hasData={wifiSamples.length > 0}
          tableMinWidthClassName="min-w-[860px]"
          variant="flush"
          hideHeader
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-left font-medium">SSID</th>
                <th className="px-4 py-3 text-left font-medium">Signal</th>
                <th className="px-4 py-3 text-left font-medium">Band</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {wifiSamples.map((sample) => (
                <tr
                  key={sample.id}
                  className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  onClick={() => {
                    setSelectedSample(sample);
                    setSampleDrawerOpen(true);
                  }}
                >
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{formatDate(sample.sampled_at)}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatSampleAge(sample.sampled_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100">
                    {sample.location_label}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {sample.ssid ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatRssi(sample.rssi_dbm)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {sample.band ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                      View sample
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <WifiSampleDetailDrawer
            sample={selectedSample}
            open={sampleDrawerOpen && !!selectedSample}
            onClose={() => {
              setSampleDrawerOpen(false);
              setSelectedSample(null);
            }}
          />
        </DataTableCard>
      </CollapsibleInspectionSection>
    </div>
  );
}
