import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import StateCard from "../components/StateCard";
import {
  api,
  type ProbeMetricsSummaryItem,
  type WifiSample,
} from "../services/api";

type MetricsWindowOption = {
  label: string;
  minutes: number;
};

const METRICS_WINDOWS: MetricsWindowOption[] = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 60 * 6 },
  { label: "24h", minutes: 60 * 24 },
  { label: "7d", minutes: 60 * 24 * 7 },
];

function formatWindowLabel(minutes: number) {
  const match = METRICS_WINDOWS.find(
    (option) => option.minutes === minutes,
  );
  return match?.label ?? `${minutes}m`;
}

function formatMetricsWindowLabel(
  minutes: number,
) {
  return `Last ${formatWindowLabel(minutes)}`;
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

function hasMeaningfulMetricsData(
  item: ProbeMetricsSummaryItem,
) {
  return item.total_checks > 0;
}

function getWifiSampleLimit(minutes: number) {
  if (minutes <= 60) return 60;
  if (minutes <= 60 * 6) return 120;
  if (minutes <= 60 * 24) return 240;
  return 500;
}

function filterWifiSamplesToWindow(
  samples: WifiSample[],
  minutes: number,
) {
  const windowStart =
    Date.now() - minutes * 60 * 1000;

  return samples.filter((sample) => {
    const parsed = new Date(sample.sampled_at);
    if (Number.isNaN(parsed.getTime()))
      return false;
    return parsed.getTime() >= windowStart;
  });
}

export default function MetricsPage() {
  const [windowMinutes, setWindowMinutes] =
    useState<number>(60);

  const httpQuery = useQuery({
    queryKey: ["health-history", windowMinutes],
    queryFn: () =>
      api.getHealthHistory(windowMinutes),
    refetchInterval: 30000,
  });

  const tcpQuery = useQuery({
    queryKey: [
      "health-history-tcp",
      windowMinutes,
    ],
    queryFn: () =>
      api.getHealthHistoryTcp(windowMinutes),
    refetchInterval: 30000,
  });

  const dnsQuery = useQuery({
    queryKey: ["dns-history", windowMinutes],
    queryFn: () =>
      api.getDnsHistory(windowMinutes),
    refetchInterval: 30000,
  });

  const metricsSummaryQuery = useQuery({
    queryKey: ["metrics-summary", windowMinutes],
    queryFn: () =>
      api.getMetricsSummary(windowMinutes),
    refetchInterval: 30000,
  });

  const wifiSamplesQuery = useQuery({
    queryKey: ["wifi-samples", windowMinutes],
    queryFn: () =>
      api.getWifiSamples(
        getWifiSampleLimit(windowMinutes),
      ),
    refetchInterval: 30000,
  });

  const metricsSummary =
    metricsSummaryQuery.data?.items ?? [];

  const allChartsFailed =
    httpQuery.isError &&
    tcpQuery.isError &&
    dnsQuery.isError;

  const chartPointCount = useMemo(
    () =>
      (httpQuery.data?.length ?? 0) +
      (tcpQuery.data?.length ?? 0) +
      (dnsQuery.data?.length ?? 0),
    [
      httpQuery.data,
      tcpQuery.data,
      dnsQuery.data,
    ],
  );

  const summaryHasAnyChecks = useMemo(
    () =>
      metricsSummary.some((item) =>
        hasMeaningfulMetricsData(item),
      ),
    [metricsSummary],
  );

  const summaryFailed =
    metricsSummaryQuery.isError;
  const summaryEmpty =
    !metricsSummaryQuery.isLoading &&
    !metricsSummaryQuery.isError &&
    (!metricsSummary.length ||
      !summaryHasAnyChecks);

  const everythingEmpty =
    !allChartsFailed &&
    chartPointCount === 0 &&
    summaryEmpty;

  const wifiSamplesInWindow = useMemo(
    () =>
      filterWifiSamplesToWindow(
        wifiSamplesQuery.data ?? [],
        windowMinutes,
      ),
    [wifiSamplesQuery.data, windowMinutes],
  );

  const latestWifiSample = useMemo(
    () => wifiSamplesInWindow[0] ?? null,
    [wifiSamplesInWindow],
  );

  const wifiChartData = useMemo(
    () =>
      wifiSamplesInWindow
        .filter(
          (sample) =>
            sample.rssi_dbm !== null &&
            sample.rssi_dbm !== undefined,
        )
        .map((sample) => ({
          timestamp: sample.sampled_at,
          value: sample.rssi_dbm as number,
        })),
    [wifiSamplesInWindow],
  );

  const statusText = useMemo(() => {
    if (allChartsFailed && summaryFailed) {
      return "Summary and chart requests failed";
    }

    if (allChartsFailed) {
      return "All chart requests failed";
    }

    if (summaryFailed) {
      return "Summary request failed";
    }

    if (everythingEmpty) {
      return `${formatMetricsWindowLabel(windowMinutes)} · No data in this window yet`;
    }

    return `${formatMetricsWindowLabel(windowMinutes)} · ${chartPointCount} chart points`;
  }, [
    allChartsFailed,
    summaryFailed,
    everythingEmpty,
    windowMinutes,
    chartPointCount,
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Metrics
          </h2>
          <p className="mt-2 text-zinc-400">
            Probe latency and DNS timing for the
            selected operating window.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <select
            value={windowMinutes}
            onChange={(e) =>
              setWindowMinutes(
                Number(e.target.value),
              )
            }
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 sm:w-auto"
          >
            {METRICS_WINDOWS.map((option) => (
              <option
                key={option.minutes}
                value={option.minutes}
              >
                Last {option.label}
              </option>
            ))}
          </select>

          <p className="text-sm text-zinc-400 sm:text-right">
            {statusText}
          </p>
        </div>
      </section>

      {allChartsFailed ? (
        <QueryState
          title="Metric charts request failed"
          tone="error"
          message="All chart endpoints failed. Check the backend and API base URL."
        />
      ) : null}

      {summaryFailed ? (
        <QueryState
          title="Metrics summary request failed"
          tone="error"
          message={
            metricsSummaryQuery.error instanceof
            Error
              ? metricsSummaryQuery.error.message
              : "The metrics summary could not be loaded."
          }
        />
      ) : null}

      {everythingEmpty ? (
        <QueryState
          title="No metrics recorded in this window"
          tone="warning"
          message={`No probe data was recorded in the selected window yet (${formatMetricsWindowLabel(
            windowMinutes,
          )}).`}
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricsSummaryQuery.isLoading &&
        metricsSummary.length === 0 ? (
          <>
            <StateCard
              title="Internet HTTP"
              message="Loading summary..."
            />
            <StateCard
              title="Internet TCP"
              message="Loading summary..."
            />
            <StateCard
              title="DNS"
              message="Loading summary..."
            />
          </>
        ) : metricsSummaryQuery.isError ? (
          <>
            <StateCard
              title="Internet HTTP"
              tone="error"
              message="Could not load summary."
            />
            <StateCard
              title="Internet TCP"
              tone="error"
              message="Could not load summary."
            />
            <StateCard
              title="DNS"
              tone="error"
              message="Could not load summary."
            />
          </>
        ) : metricsSummary.length === 0 ? (
          <>
            <StateCard
              title="Internet HTTP"
              tone="warning"
              message="No summary data available yet."
            />
            <StateCard
              title="Internet TCP"
              tone="warning"
              message="No summary data available yet."
            />
            <StateCard
              title="DNS"
              tone="warning"
              message="No summary data available yet."
            />
          </>
        ) : (
          metricsSummary.map(
            (item: ProbeMetricsSummaryItem) =>
              !hasMeaningfulMetricsData(item) ? (
                <StateCard
                  key={item.key}
                  title={item.label}
                  tone="warning"
                  message="No checks were recorded in this window yet."
                />
              ) : (
                <div
                  key={item.key}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium">
                        {item.label}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {formatMetricsWindowLabel(
                          windowMinutes,
                        )}{" "}
                        · {item.total_checks}{" "}
                        checks
                      </p>
                    </div>

                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                      {item.success_rate_pct.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Successes
                      </div>
                      <div className="mt-2 text-sm text-zinc-100">
                        {item.success_count}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Failures
                      </div>
                      <div className="mt-2 text-sm text-zinc-100">
                        {item.failure_count}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Avg latency
                      </div>
                      <div className="mt-2 text-sm text-zinc-100">
                        {item.avg_latency_ms.toFixed(
                          1,
                        )}{" "}
                        ms
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Latest latency
                      </div>
                      <div className="mt-2 text-sm text-zinc-100">
                        {item.latest_latency_ms !==
                          null &&
                        item.latest_latency_ms !==
                          undefined
                          ? `${item.latest_latency_ms.toFixed(1)} ms`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-zinc-500">
                    Last checked{" "}
                    {formatDate(
                      item.last_checked_at,
                    )}
                  </p>
                </div>
              ),
          )
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Wi-Fi signal
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Recent Wi-Fi sampling across the
            selected operating window.
          </p>
        </div>

        {wifiSamplesQuery.isLoading &&
        !latestWifiSample ? (
          <StateCard
            title="Wi-Fi latest sample"
            message="Loading Wi-Fi samples..."
          />
        ) : wifiSamplesQuery.isError ? (
          <StateCard
            title="Wi-Fi latest sample"
            tone="error"
            message={
              wifiSamplesQuery.error instanceof
              Error
                ? wifiSamplesQuery.error.message
                : "Could not load Wi-Fi samples."
            }
          />
        ) : !latestWifiSample ? (
          <StateCard
            title="Wi-Fi latest sample"
            tone="warning"
            message="No Wi-Fi samples were recorded in this window yet."
          />
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-medium">
                  {
                    latestWifiSample.location_label
                  }
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Interface{" "}
                  {
                    latestWifiSample.interface_name
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {latestWifiSample.band ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                    {latestWifiSample.band}
                  </span>
                ) : null}

                {latestWifiSample.ssid ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                    {latestWifiSample.ssid}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Signal
                </div>
                <div className="mt-2 text-sm text-zinc-100">
                  {formatRssi(
                    latestWifiSample.rssi_dbm,
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Frequency
                </div>
                <div className="mt-2 text-sm text-zinc-100">
                  {latestWifiSample.frequency_mhz !=
                  null
                    ? `${latestWifiSample.frequency_mhz} MHz`
                    : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  BSSID
                </div>
                <div className="mt-2 break-all text-sm text-zinc-100">
                  {latestWifiSample.bssid ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Sampled
                </div>
                <div className="mt-2 text-sm text-zinc-100">
                  {formatDate(
                    latestWifiSample.sampled_at,
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <ChartCard
        title={`Internet HTTP latency · ${formatMetricsWindowLabel(windowMinutes)}`}
        data={httpQuery.data ?? []}
        isLoading={httpQuery.isLoading}
        isError={httpQuery.isError}
        errorMessage={
          httpQuery.error instanceof Error
            ? httpQuery.error.message
            : "Internet HTTP request failed."
        }
      />

      <ChartCard
        title={`Internet TCP latency · ${formatMetricsWindowLabel(windowMinutes)}`}
        data={tcpQuery.data ?? []}
        isLoading={tcpQuery.isLoading}
        isError={tcpQuery.isError}
        errorMessage={
          tcpQuery.error instanceof Error
            ? tcpQuery.error.message
            : "Internet TCP request failed."
        }
      />

      <ChartCard
        title={`DNS response time · ${formatMetricsWindowLabel(windowMinutes)}`}
        data={dnsQuery.data ?? []}
        isLoading={dnsQuery.isLoading}
        isError={dnsQuery.isError}
        errorMessage={
          dnsQuery.error instanceof Error
            ? dnsQuery.error.message
            : "DNS history request failed."
        }
      />

      <ChartCard
        title={`Wi-Fi signal strength · ${formatMetricsWindowLabel(windowMinutes)}`}
        data={wifiChartData}
        isLoading={wifiSamplesQuery.isLoading}
        isError={wifiSamplesQuery.isError}
        errorMessage={
          wifiSamplesQuery.error instanceof Error
            ? wifiSamplesQuery.error.message
            : "Wi-Fi history request failed."
        }
        valueFormatter={(value) =>
          `${value.toFixed(0)} dBm`
        }
        valueLabel="Signal"
      />
    </div>
  );
}
