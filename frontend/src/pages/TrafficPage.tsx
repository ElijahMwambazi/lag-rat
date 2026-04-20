import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DataTableCard from "../components/DataTableCard";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import PageFilterBar from "../components/PageFilterBar";
import { api, type TrafficSample } from "../services/api";

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

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatInterfaceName(value?: string | null) {
  if (!value) return "—";
  return value;
}

function formatSampleAge(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  const diffMs = Date.now() - parsed.getTime();

  if (Number.isNaN(parsed.getTime()) || diffMs < 0) {
    return "Unknown";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export default function TrafficPage() {
  const [windowMinutes, setWindowMinutes] = useState(60);

  const [selectedInterface, setSelectedInterface] = useState("");

  const trafficSummaryQuery = useQuery({
    queryKey: ["traffic-summary", windowMinutes],
    queryFn: () => api.getTrafficSummary(windowMinutes),
    refetchInterval: 30000,
  });

  const topTalkersQuery = useQuery({
    queryKey: ["traffic-top-talkers", windowMinutes, 20],
    queryFn: () => api.getTrafficTopTalkers(windowMinutes, 20),
    refetchInterval: 30000,
  });

  const trafficSamplesQuery = useQuery({
    queryKey: ["traffic-samples", windowMinutes, 20],
    queryFn: () => api.getTrafficSamples(windowMinutes, 20),
    refetchInterval: 30000,
  });

  const trafficSamples: TrafficSample[] = trafficSamplesQuery.data ?? [];

  const summary = trafficSummaryQuery.data;

  const topTalkers = topTalkersQuery.data?.items ?? [];

  const interfaceOptions = useMemo(() => {
    const values = new Set<string>();

    for (const item of topTalkers) {
      if (item.interface_name?.trim()) {
        values.add(item.interface_name);
      }
    }

    for (const item of trafficSamples) {
      if (item.interface_name?.trim()) {
        values.add(item.interface_name);
      }
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [topTalkers, trafficSamples]);

  const filteredTopTalkers = useMemo(() => {
    if (!selectedInterface) {
      return topTalkers;
    }

    return topTalkers.filter(
      (item) => item.interface_name === selectedInterface,
    );
  }, [topTalkers, selectedInterface]);

  const filteredTrafficSamples = useMemo(() => {
    if (!selectedInterface) {
      return trafficSamples;
    }

    return trafficSamples.filter(
      (item) => item.interface_name === selectedInterface,
    );
  }, [trafficSamples, selectedInterface]);

  const totalDeltaBytes = useMemo(
    () =>
      filteredTopTalkers.reduce((sum, item) => sum + item.delta_bytes_total, 0),
    [filteredTopTalkers],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageFilterBar
        title="Traffic"
        description="Interface-level traffic summaries and top talkers across the selected operational window."
        controls={
          <>
            <select
              aria-label="Traffic window"
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(Number(event.target.value))}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value={15}>Last 15m</option>
              <option value={60}>Last 1h</option>
              <option value={360}>Last 6h</option>
              <option value={1440}>Last 24h</option>
            </select>

            <select
              aria-label="Traffic interface"
              value={selectedInterface}
              onChange={(event) => setSelectedInterface(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="">All interfaces</option>
              {interfaceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </>
        }
      >
        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
          Summary window · {windowMinutes}m
        </span>

        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
          {selectedInterface
            ? `Interface · ${selectedInterface}`
            : "Interface · All interfaces"}
        </span>
      </PageFilterBar>

      {trafficSummaryQuery.isError ? (
        <QueryState
          title="Traffic summary request failed"
          tone="error"
          message={
            trafficSummaryQuery.error instanceof Error
              ? trafficSummaryQuery.error.message
              : "Traffic summary could not be loaded."
          }
        />
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Traffic summary</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Recent interface traffic across the current dashboard window.
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
                    summary.interface_count === 1 ? "" : "s"
                  } observed`
                : "Waiting for traffic summary"
            }
          />

          <StatCard
            label="RX total"
            value={
              summary
                ? formatBytes(summary.total_bytes_rx)
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
                ? formatBytes(summary.total_bytes_tx)
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
                ? formatInterfaceName(summary.top_talker.interface_name)
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
          <h3 className="text-lg font-medium">Top talkers</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Interfaces ranked by traffic delta over the selected window.
          </p>
        </div>

        <DataTableCard
          title="Top talkers"
          description="Ranked by total byte movement across the selected window."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {filteredTopTalkers.length} item
                {filteredTopTalkers.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {formatBytes(totalDeltaBytes)} total delta
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
          hasData={filteredTopTalkers.length > 0}
          tableMinWidthClassName="min-w-[980px]"
          variant="flush"
          hideHeader
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Interface</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">RX delta</th>
                <th className="px-4 py-3 text-left font-medium">TX delta</th>
                <th className="px-4 py-3 text-left font-medium">Total delta</th>
                <th className="px-4 py-3 text-left font-medium">
                  Latest sample
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTopTalkers.map((item) => (
                <tr
                  key={`${item.interface_name}-${item.entity_key}`}
                  className="border-t border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-100">
                    {formatInterfaceName(item.interface_name)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{item.entity_key}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.entity_type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(item.delta_bytes_rx)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(item.delta_bytes_tx)}
                  </td>
                  <td className="px-4 py-3 text-zinc-100">
                    {formatBytes(item.delta_bytes_total)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatDate(item.latest_sampled_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Recent traffic samples</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Most recent interface counter samples captured in the selected
            window.
          </p>
        </div>

        <DataTableCard
          title="Recent traffic samples"
          description="Latest raw traffic counter observations for the selected window."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {filteredTrafficSamples.length} sample
                {filteredTrafficSamples.length === 1 ? "" : "s"}
              </span>
            </div>
          }
          helperText="These are raw interface-level samples. Deltas and rankings are shown in the top-talkers table above."
          isLoading={trafficSamplesQuery.isLoading}
          isError={trafficSamplesQuery.isError}
          errorMessage={
            trafficSamplesQuery.error instanceof Error
              ? trafficSamplesQuery.error.message
              : "Traffic samples could not be loaded."
          }
          emptyTitle="Recent traffic samples"
          emptyMessage="No traffic samples were available for this window."
          hasData={filteredTrafficSamples.length > 0}
          tableMinWidthClassName="min-w-[1080px]"
          variant="flush"
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Interface</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">RX bytes</th>
                <th className="px-4 py-3 text-left font-medium">TX bytes</th>
                <th className="px-4 py-3 text-left font-medium">RX packets</th>
                <th className="px-4 py-3 text-left font-medium">TX packets</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrafficSamples.map((item) => (
                <tr key={item.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{formatDate(item.sampled_at)}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatSampleAge(item.sampled_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100">
                    {formatInterfaceName(item.interface_name)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{item.entity_key}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.entity_type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(item.bytes_rx)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatBytes(item.bytes_tx)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {item.packets_rx ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {item.packets_tx ?? "—"}
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
