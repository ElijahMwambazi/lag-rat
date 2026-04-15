import { useMemo, useState } from "react";
import {
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import StateCard from "../components/StateCard";
import {
  api,
  type WifiLocationsResponse,
  type WifiSample,
  type WifiSummaryResponse,
} from "../services/api";

type WindowOption = {
  label: string;
  minutes: number;
};

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

function getRoomCardClasses(active: boolean) {
  return [
    "rounded-2xl border p-4 text-left transition-colors",
    active
      ? "border-zinc-500 bg-zinc-800/80"
      : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60",
  ].join(" ");
}

export default function WifiPage() {
  const [windowMinutes, setWindowMinutes] =
    useState(60);
  const [locationLabel, setLocationLabel] =
    useState("");

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

  const comparisonQueries = useQueries({
    queries: locationOptions.map((location) => ({
      queryKey: [
        "wifi-summary",
        "comparison",
        windowMinutes,
        location,
      ],
      queryFn: () =>
        api.getWifiSummary({
          minutes: windowMinutes,
          location_label: location,
        }),
      refetchInterval: 30000,
      enabled: locationOptions.length > 0,
    })),
  });

  const roomComparisonItems = locationOptions.map(
    (location, index) => ({
      location,
      query: comparisonQueries[index],
    }),
  );

  const wifiSamples: WifiSample[] =
    samplesQuery.data ?? [];

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
              onChange={(e) =>
                setWindowMinutes(
                  Number(e.target.value),
                )
              }
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
              onChange={(e) =>
                setLocationLabel(e.target.value)
              }
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
        <div>
          <h3 className="text-lg font-medium">
            Room comparison
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Compare the latest sampled Wi-Fi state
            by location and jump directly into a
            room.
          </p>
        </div>

        {locationsQuery.isLoading &&
        locationOptions.length === 0 ? (
          <QueryState
            title="Room comparison"
            message="Loading Wi-Fi locations..."
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
              onClick={() => setLocationLabel("")}
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

                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                  {locationOptions.length} rooms
                </span>
              </div>
            </button>

            {roomComparisonItems.map(
              ({ location, query }) => {
                const latest =
                  query.data?.latest_sample ??
                  null;

                return (
                  <button
                    key={location}
                    type="button"
                    onClick={() =>
                      setLocationLabel(location)
                    }
                    className={getRoomCardClasses(
                      locationLabel === location,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-100">
                          {location}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {query.isLoading
                            ? "Loading summary..."
                            : (latest?.ssid ??
                              "SSID unavailable")}
                        </p>
                      </div>

                      {latest?.band ? (
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                          {latest.band}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 text-xl font-semibold text-zinc-100">
                      {query.isLoading
                        ? "…"
                        : latest
                          ? formatRssi(
                              latest.rssi_dbm,
                            )
                          : "—"}
                    </div>

                    <p className="mt-2 text-xs text-zinc-500">
                      {query.isLoading
                        ? "Loading latest sample"
                        : latest
                          ? `Sampled ${formatDate(latest.sampled_at)}`
                          : "No Wi-Fi sample in this window"}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        )}
      </section>

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
        <div className="mb-4">
          <h3 className="text-lg font-medium">
            Recent samples
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Most recent Wi-Fi observations for the
            selected window.
          </p>
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
