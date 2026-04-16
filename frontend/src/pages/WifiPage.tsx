import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import StateCard from "../components/StateCard";
import {
  api,
  type Alert,
  type WifiLocationSummariesResponse,
  type WifiLocationsResponse,
  type WifiSample,
  type WifiSummaryResponse,
} from "../services/api";

type WindowOption = {
  label: string;
  minutes: number;
};

type RoomHealthTone =
  | "healthy"
  | "warning"
  | "critical"
  | "stale";

const WINDOWS: WindowOption[] = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 60 * 6 },
  { label: "24h", minutes: 60 * 24 },
  { label: "7d", minutes: 60 * 24 * 7 },
];

function formatWindowLabel(minutes: number) {
  const match = WINDOWS.find(
    (option) => option.minutes === minutes,
  );
  return match?.label ?? `${minutes}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString();
}

function formatRssi(value?: number | null) {
  if (value === null || value === undefined)
    return "—";
  return `${value} dBm`;
}

function formatSampleAge(value?: string | null) {
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
  if (diffMinutes < 60)
    return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

function getRoomStatusDescription(
  tone: RoomHealthTone,
) {
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

function getRoomStatusBadgeClasses(
  tone: RoomHealthTone,
) {
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

function SelectionBadge({
  active,
}: {
  active: boolean;
}) {
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
        alert.alert_type ===
          "wifi_samples_stale" &&
        alert.severity === "critical",
    )
  ) {
    return { label: "Stale", tone: "critical" };
  }

  if (
    roomAlerts.some(
      (alert) =>
        alert.alert_type === "wifi_samples_stale",
    )
  ) {
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

  if (
    roomAlerts.some(
      (alert) =>
        alert.alert_type === "wifi_signal_weak",
    )
  ) {
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

function getRecentSamplesTitle(
  locationLabel: string,
) {
  return locationLabel
    ? `Recent samples · ${locationLabel}`
    : "Recent samples";
}

export default function WifiPage() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const initialMinutesParam = Number(
    searchParams.get("minutes") ?? "60",
  );

  const initialWindowMinutes = WINDOWS.some(
    (option) =>
      option.minutes === initialMinutesParam,
  )
    ? initialMinutesParam
    : 60;

  const initialLocationLabel =
    searchParams.get("location") ?? "";

  const [windowMinutes, setWindowMinutes] =
    useState(initialWindowMinutes);
  const [locationLabel, setLocationLabel] =
    useState(initialLocationLabel);

  const locationsQuery =
    useQuery<WifiLocationsResponse>({
      queryKey: ["wifi-locations"],
      queryFn: api.getWifiLocations,
      refetchInterval: 30000,
    });

  const summaryQuery =
    useQuery<WifiSummaryResponse>({
      queryKey: [
        "wifi-summary",
        windowMinutes,
        locationLabel,
      ],
      queryFn: () =>
        api.getWifiSummary({
          minutes: windowMinutes,
          location_label:
            locationLabel || undefined,
        }),
      refetchInterval: 30000,
    });

  const samplesQuery = useQuery<WifiSample[]>({
    queryKey: [
      "wifi-samples",
      windowMinutes,
      locationLabel,
    ],
    queryFn: () =>
      api.getWifiSamples({
        minutes: windowMinutes,
        location_label:
          locationLabel || undefined,
        limit: 200,
      }),
    refetchInterval: 30000,
  });

  const latestSample =
    summaryQuery.data?.latest_sample ?? null;

  const locationOptions: string[] =
    locationsQuery.data?.items ?? [];

  const locationSummariesQuery =
    useQuery<WifiLocationSummariesResponse>({
      queryKey: [
        "wifi-location-summaries",
        windowMinutes,
      ],
      queryFn: () =>
        api.getWifiLocationSummaries({
          minutes: windowMinutes,
        }),
      refetchInterval: 30000,
    });

  const roomComparisonItems =
    locationSummariesQuery.data?.items ?? [];

  const wifiSamples: WifiSample[] =
    samplesQuery.data ?? [];

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

  const activeWifiAlerts =
    wifiAlertsQuery.data ?? [];

  const selectedRoomAlerts = locationLabel
    ? activeWifiAlerts.filter(
        (alert) =>
          alert.is_active &&
          alert.entity_type === "wifi" &&
          alert.entity_key === locationLabel,
      )
    : [];

  const selectedRoomStatus = locationLabel
    ? getRoomHealthStatus(
        activeWifiAlerts,
        locationLabel,
      )
    : null;

  const selectedRoomPrimaryAlert =
    selectedRoomAlerts[0] ?? null;

  const wifiChartData = useMemo(
    () =>
      wifiSamples
        .filter(
          (sample) =>
            sample.rssi_dbm !== null &&
            sample.rssi_dbm !== undefined,
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
  }) {
    const params = new URLSearchParams();

    if (next.location) {
      params.set("location", next.location);
    }

    if (next.minutes !== 60) {
      params.set("minutes", String(next.minutes));
    }

    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Wi-Fi
          </h2>
          <p className="mt-2 text-zinc-400">
            Room-based Wi-Fi signal history and
            latest observed link state.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={windowMinutes}
              onChange={(e) => {
                const nextMinutes = Number(
                  e.target.value,
                );
                setWindowMinutes(nextMinutes);
                updateSearchParams({
                  minutes: nextMinutes,
                  location: locationLabel,
                });
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              {WINDOWS.map((option) => (
                <option
                  key={option.minutes}
                  value={option.minutes}
                >
                  Last {option.label}
                </option>
              ))}
            </select>

            <select
              value={locationLabel}
              onChange={(e) => {
                const nextLocation =
                  e.target.value;
                setLocationLabel(nextLocation);
                updateSearchParams({
                  minutes: windowMinutes,
                  location: nextLocation,
                });
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="">
                All locations
              </option>
              {locationOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-zinc-400 sm:text-right">
            Last{" "}
            {formatWindowLabel(windowMinutes)}
            {locationLabel
              ? ` · ${locationLabel}`
              : ""}
          </p>
        </div>
      </section>

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
            <h3 className="text-lg font-medium">
              Room comparison
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Compare the latest sampled Wi-Fi
              state by location and jump directly
              into a room.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Viewing:{" "}
              {getViewingLabel(locationLabel)}
            </span>

            {locationLabel ? (
              <button
                type="button"
                onClick={() => {
                  setLocationLabel("");
                  updateSearchParams({
                    minutes: windowMinutes,
                    location: "",
                  });
                }}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                Clear room filter
              </button>
            ) : null}
          </div>
        </div>

        {(locationsQuery.isLoading ||
          locationSummariesQuery.isLoading) &&
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
              locationSummariesQuery.error instanceof
              Error
                ? locationSummariesQuery.error
                    .message
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
                updateSearchParams({
                  minutes: windowMinutes,
                  location: "",
                });
              }}
              className={getRoomCardClasses(
                locationLabel === "",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    All locations
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Combined Wi-Fi view
                  </p>
                </div>

                <div className="flex min-h-[44px] flex-col items-end gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                    {locationOptions.length} rooms
                  </span>
                  <SelectionBadge
                    active={locationLabel === ""}
                  />
                </div>
              </div>
            </button>

            {roomComparisonItems.map((item) => {
              const location =
                item.location_label;
              const latest =
                item.latest_sample ?? null;
              const isActive =
                locationLabel === location;

              const roomHealth =
                getRoomHealthStatus(
                  activeWifiAlerts,
                  location,
                );

              return (
                <button
                  key={location}
                  type="button"
                  onClick={() => {
                    setLocationLabel(location);
                    updateSearchParams({
                      minutes: windowMinutes,
                      location,
                    });
                  }}
                  className={getRoomCardClasses(
                    isActive,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">
                        {location}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {latest?.ssid ??
                          "SSID unavailable"}
                      </p>
                    </div>

                    <div className="flex min-h-[68px] flex-col items-end gap-2">
                      {latest?.band ? (
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                          {latest.band}
                        </span>
                      ) : (
                        <span
                          className="rounded-full border border-transparent bg-transparent px-2 py-0.5 text-[11px] text-transparent"
                          aria-hidden="true"
                        >
                          —
                        </span>
                      )}

                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          getRoomStatusBadgeClasses(
                            roomHealth.tone,
                          ),
                        ].join(" ")}
                      >
                        {roomHealth.label}
                      </span>

                      <SelectionBadge
                        active={isActive}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-xl font-semibold text-zinc-100">
                    {latest
                      ? formatRssi(
                          latest.rssi_dbm,
                        )
                      : "—"}
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    {latest
                      ? `Sampled ${formatDate(latest.sampled_at)}`
                      : "No Wi-Fi sample in this window"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {locationLabel ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-medium">
                Selected room status
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Current health interpretation for{" "}
                {locationLabel}.
              </p>
            </div>

            {selectedRoomStatus ? (
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs",
                  getRoomStatusBadgeClasses(
                    selectedRoomStatus.tone,
                  ),
                ].join(" ")}
              >
                {selectedRoomStatus.label}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Current assessment
              </div>

              <div className="mt-3 text-base font-medium text-zinc-100">
                {selectedRoomPrimaryAlert?.message ??
                  "No active Wi-Fi alerts for this room."}
              </div>

              <p className="mt-3 text-sm text-zinc-400">
                {selectedRoomStatus
                  ? getRoomStatusDescription(
                      selectedRoomStatus.tone,
                    )
                  : "No current room status available."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Sample age
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-100">
                  {formatSampleAge(
                    latestSample?.sampled_at,
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Link details
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-100">
                  {latestSample?.band ?? "—"}
                  {latestSample?.frequency_mhz !=
                  null
                    ? ` · ${latestSample.frequency_mhz} MHz`
                    : ""}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Samples in window
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-100">
                  {summaryQuery.data
                    ?.sample_count ?? 0}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading &&
        !summaryQuery.data ? (
          <>
            <StateCard
              title="Latest signal"
              message="Loading Wi-Fi summary..."
            />
            <StateCard
              title="Average RSSI"
              message="Loading Wi-Fi summary..."
            />
            <StateCard
              title="Samples"
              message="Loading Wi-Fi summary..."
            />
            <StateCard
              title="Band"
              message="Loading Wi-Fi summary..."
            />
          </>
        ) : !summaryQuery.data ||
          !latestSample ? (
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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Latest signal
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {formatRssi(
                  latestSample.rssi_dbm,
                )}
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                {latestSample.location_label} ·{" "}
                {latestSample.ssid ??
                  "Unknown SSID"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Average RSSI
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {summaryQuery.data.avg_rssi_dbm !=
                null
                  ? `${summaryQuery.data.avg_rssi_dbm.toFixed(1)} dBm`
                  : "—"}
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Min{" "}
                {formatRssi(
                  summaryQuery.data.min_rssi_dbm,
                )}{" "}
                · Max{" "}
                {formatRssi(
                  summaryQuery.data.max_rssi_dbm,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Samples
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {summaryQuery.data.sample_count}
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Sampled through{" "}
                {formatDate(
                  latestSample.sampled_at,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Band
              </div>
              <div className="mt-3 text-2xl font-semibold">
                {latestSample.band ?? "—"}
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                {latestSample.frequency_mhz !=
                null
                  ? `${latestSample.frequency_mhz} MHz`
                  : "Frequency unavailable"}
              </p>
            </div>
          </>
        )}
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
        valueFormatter={(value) =>
          `${value.toFixed(0)} dBm`
        }
        valueLabel="Signal"
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-medium">
              {getRecentSamplesTitle(
                locationLabel,
              )}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Most recent Wi-Fi observations for
              the selected window.
            </p>
          </div>

          {locationLabel ? (
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              Filtered to {locationLabel}
            </span>
          ) : null}
        </div>

        {samplesQuery.isLoading &&
        wifiSamples.length === 0 ? (
          <QueryState
            title="Recent Wi-Fi samples"
            message="Loading sample history..."
          />
        ) : samplesQuery.isError ? (
          <QueryState
            title="Recent Wi-Fi samples"
            tone="error"
            message={
              samplesQuery.error instanceof Error
                ? samplesQuery.error.message
                : "Sample history could not be loaded."
            }
          />
        ) : wifiSamples.length === 0 ? (
          <QueryState
            title="Recent Wi-Fi samples"
            tone="warning"
            message="No Wi-Fi samples were recorded in this window yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-2 font-medium">
                    Time
                  </th>
                  <th className="px-3 py-2 font-medium">
                    Location
                  </th>
                  <th className="px-3 py-2 font-medium">
                    SSID
                  </th>
                  <th className="px-3 py-2 font-medium">
                    Signal
                  </th>
                  <th className="px-3 py-2 font-medium">
                    Band
                  </th>
                </tr>
              </thead>
              <tbody>
                {wifiSamples.map((sample) => (
                  <tr
                    key={sample.id}
                    className="border-b border-zinc-900"
                  >
                    <td className="px-3 py-2 text-zinc-300">
                      {formatDate(
                        sample.sampled_at,
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-100">
                      {sample.location_label}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {sample.ssid ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {formatRssi(
                        sample.rssi_dbm,
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {sample.band ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
