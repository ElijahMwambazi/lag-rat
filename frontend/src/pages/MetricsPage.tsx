import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import { api } from "../services/api";

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
              ? "Loading failed"
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
