import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DataTableCard from "../components/DataTableCard";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import { api } from "../services/api";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
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

export default function TrafficPage() {
  const [windowMinutes, setWindowMinutes] =
    useState(60);

  const trafficSummaryQuery = useQuery({
    queryKey: ["traffic-summary", windowMinutes],
    queryFn: () =>
      api.getTrafficSummary(windowMinutes),
    refetchInterval: 30000,
  });

  const topTalkersQuery = useQuery({
    queryKey: [
      "traffic-top-talkers",
      windowMinutes,
      20,
    ],
    queryFn: () =>
      api.getTrafficTopTalkers(windowMinutes, 20),
    refetchInterval: 30000,
  });

  const summary = trafficSummaryQuery.data;
  const topTalkers =
    topTalkersQuery.data?.items ?? [];

  const totalDeltaBytes = useMemo(
    () =>
      topTalkers.reduce(
        (sum, item) =>
          sum + item.delta_bytes_total,
        0,
      ),
    [topTalkers],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Traffic
          </h2>
          <p className="mt-2 text-zinc-400">
            Interface-level traffic summaries and
            top talkers across the selected
            operational window.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <select
            value={windowMinutes}
            onChange={(event) =>
              setWindowMinutes(
                Number(event.target.value),
              )
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value={15}>Last 15m</option>
            <option value={60}>Last 1h</option>
            <option value={360}>Last 6h</option>
            <option value={1440}>Last 24h</option>
          </select>
          <p className="text-sm text-zinc-400">
            Summary window · {windowMinutes}m
          </p>
        </div>
      </section>

      {trafficSummaryQuery.isError ? (
        <QueryState
          title="Traffic summary request failed"
          tone="error"
          message={
            trafficSummaryQuery.error instanceof
            Error
              ? trafficSummaryQuery.error.message
              : "Traffic summary could not be loaded."
          }
        />
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Traffic summary
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Recent interface traffic across the
            current dashboard window.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`Traffic (${windowMinutes}m)`}
            value={
              summary
                ? formatBytes(summary.total_bytes)
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint={
              summary
                ? `${summary.interface_count} interface${
                    summary.interface_count === 1
                      ? ""
                      : "s"
                  } observed`
                : "Waiting for traffic summary"
            }
          />

          <StatCard
            label="RX total"
            value={
              summary
                ? formatBytes(
                    summary.total_bytes_rx,
                  )
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint="Received bytes in selected window"
          />

          <StatCard
            label="TX total"
            value={
              summary
                ? formatBytes(
                    summary.total_bytes_tx,
                  )
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint="Transmitted bytes in selected window"
          />

          <StatCard
            label="Top talker"
            value={
              summary?.top_talker
                ? formatInterfaceName(
                    summary.top_talker
                      .interface_name,
                  )
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint={
              summary?.top_talker
                ? `${formatBytes(summary.top_talker.delta_bytes_total)} moved in window`
                : "No ranked traffic yet"
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            Top talkers
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Interfaces ranked by traffic delta
            over the selected window.
          </p>
        </div>

        <DataTableCard
          title="Top talkers"
          description="Ranked by total byte movement across the selected window."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {topTalkers.length} item
                {topTalkers.length === 1
                  ? ""
                  : "s"}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {formatBytes(totalDeltaBytes)}{" "}
                total delta
              </span>
            </div>
          }
          helperText="This first version uses interface-level counters, so virtual interfaces may appear until filtering rules are added."
          isLoading={topTalkersQuery.isLoading}
          isError={topTalkersQuery.isError}
          errorMessage={
            topTalkersQuery.error instanceof Error
              ? topTalkersQuery.error.message
              : "Top talkers could not be loaded."
          }
          emptyTitle="Top talkers"
          emptyMessage="No traffic samples were available for this window."
          hasData={topTalkers.length > 0}
          tableMinWidthClassName="min-w-[980px]"
          variant="flush"
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Interface
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Entity
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  RX delta
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  TX delta
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Total delta
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Latest sample
                </th>
              </tr>
            </thead>
            <tbody>
              {topTalkers.map((item) => (
                <tr
                  key={`${item.interface_name}-${item.entity_key}`}
                  className="border-t border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-100">
                    {formatInterfaceName(
                      item.interface_name,
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{item.entity_key}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.entity_type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(
                      item.delta_bytes_rx,
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(
                      item.delta_bytes_tx,
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-100">
                    {formatBytes(
                      item.delta_bytes_total,
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatDate(
                      item.latest_sampled_at,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>
      </section>
    </div>
  );
}
