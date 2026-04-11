import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import StateCard from "../components/StateCard";
import {
  api,
  type ProbeMetricsSummaryItem,
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString();
}

function hasMeaningfulMetricsData(
  item: ProbeMetricsSummaryItem,
) {
  return item.total_checks > 0;
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

  const metricsSummary =
    metricsSummaryQuery.data?.items ?? [];

  const allFailed =
    httpQuery.isError &&
    tcpQuery.isError &&
    dnsQuery.isError;

  const totalPointCount = useMemo(
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

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Metrics
          </h2>
          <p className="mt-2 text-zinc-400">
            Latency and DNS response trends from
            SQLite-backed probe data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={windowMinutes}
            onChange={(e) =>
              setWindowMinutes(
                Number(e.target.value),
              )
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
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

          <p className="text-sm text-zinc-400">
            {allFailed
              ? "All chart requests failed"
              : `${formatWindowLabel(windowMinutes)} window · ${totalPointCount} points`}
          </p>
        </div>
      </section>

      {allFailed ? (
        <QueryState
          title="Metrics requests failed"
          tone="error"
          message="All metrics endpoints failed. Check the backend and API base URL."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  message="No checks recorded in this window yet."
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
                        {item.total_checks} checks
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

      <ChartCard
        title={`Internet HTTP Latency (${formatWindowLabel(windowMinutes)})`}
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
        title={`Internet TCP Latency (${formatWindowLabel(windowMinutes)})`}
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
        title={`DNS Response Time (${formatWindowLabel(windowMinutes)})`}
        data={dnsQuery.data ?? []}
        isLoading={dnsQuery.isLoading}
        isError={dnsQuery.isError}
        errorMessage={
          dnsQuery.error instanceof Error
            ? dnsQuery.error.message
            : "DNS history request failed."
        }
      />
    </div>
  );
}
