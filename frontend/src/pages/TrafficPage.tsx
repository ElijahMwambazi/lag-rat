import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DataTableCard from "../components/DataTableCard";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import PageFilterBar from "../components/PageFilterBar";
import CollapsibleInspectionSection from "../components/CollapsibleInspectionSection";
import TrafficSampleDetailDrawer from "../components/TrafficSampleDetailDrawer";
import { api, type TrafficSample } from "../services/api";

const WINDOWS = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
];

function formatWindowLabel(minutes: number) {
  const match = WINDOWS.find((option) => option.minutes === minutes);
  return match?.label ?? `${minutes}m`;
}

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

function getViewingLabel(selectedInterface: string) {
  return selectedInterface || "All interfaces";
}

export default function TrafficPage() {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [selectedInterface, setSelectedInterface] = useState("");
  const [selectedSample, setSelectedSample] = useState<TrafficSample | null>(
    null,
  );
  const [sampleDrawerOpen, setSampleDrawerOpen] = useState(false);
  const [samplesCollapsed, setSamplesCollapsed] = useState(true);

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

  const latestSample = filteredTrafficSamples[0] ?? null;

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
          Window · Last {formatWindowLabel(windowMinutes)}
        </span>

        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
          Viewing · {getViewingLabel(selectedInterface)}
        </span>

        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
          {interfaceOptions.length} interface
          {interfaceOptions.length === 1 ? "" : "s"} visible
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
          <h3 className="text-lg font-medium">Traffic overview</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Recent traffic activity across the selected operational window.
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
                : "Waiting for traffic overview"
            }
          />

          <StatCard
            label="Received"
            value={
              summary
                ? formatBytes(summary.total_bytes_rx)
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint="Across visible interfaces"
          />

          <StatCard
            label="Sent"
            value={
              summary
                ? formatBytes(summary.total_bytes_tx)
                : trafficSummaryQuery.isLoading
                  ? "Loading"
                  : "—"
            }
            hint="Across visible interfaces"
          />

          <StatCard
            label="Top mover"
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
            Interfaces with the most byte movement in the selected window.
          </p>
        </div>

        <DataTableCard
          title="Top talkers"
          description="Ranked by byte movement between the earliest and latest samples in the selected window."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {filteredTopTalkers.length} item
                {filteredTopTalkers.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {formatBytes(totalDeltaBytes)} moved
              </span>
            </div>
          }
          helperText="This ranked view shows traffic movement across interface-level counters for the selected scope."
          isLoading={topTalkersQuery.isLoading}
          isError={topTalkersQuery.isError}
          errorMessage={
            topTalkersQuery.error instanceof Error
              ? topTalkersQuery.error.message
              : "Top talkers could not be loaded."
          }
          emptyTitle="Top talkers"
          emptyMessage="No ranked traffic was available for this window."
          hasData={filteredTopTalkers.length > 0}
          tableMinWidthClassName="min-w-[980px]"
          variant="flush"
          hideHeader
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Interface</th>
                <th className="px-4 py-3 text-left font-medium">Scope</th>
                <th className="px-4 py-3 text-left font-medium">Received</th>
                <th className="px-4 py-3 text-left font-medium">Sent</th>
                <th className="px-4 py-3 text-left font-medium">Total moved</th>
                <th className="px-4 py-3 text-left font-medium">Last seen</th>
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
                    <div>{formatDate(item.latest_sampled_at)}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatSampleAge(item.latest_sampled_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>
      </section>

      <CollapsibleInspectionSection
        title="Recent traffic samples"
        description="Latest raw counter samples captured for the selected interface scope."
        badges={
          <>
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              Viewing · {getViewingLabel(selectedInterface)}
            </span>

            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              {filteredTrafficSamples.length} sample
              {filteredTrafficSamples.length === 1 ? "" : "s"}
            </span>

            {latestSample ? (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                Latest sample · {formatSampleAge(latestSample.sampled_at)}
              </span>
            ) : null}
          </>
        }
        collapsedSummary="Recent traffic samples are collapsed by default. Expand the table to inspect raw counters and open row-level detail."
        collapsedDetail="Expand this section to inspect raw traffic counters and open the sample detail drawer."
        collapsedActionLabel="Expand table"
        expandedActionLabel="Hide samples"
        isExpanded={
          !samplesCollapsed ||
          filteredTrafficSamples.length === 0 ||
          trafficSamplesQuery.isLoading ||
          trafficSamplesQuery.isError
        }
        onToggle={() => setSamplesCollapsed((current) => !current)}
      >
        <DataTableCard
          title="Recent traffic samples"
          description="Latest raw counter observations for the selected interface scope."
          rightSlot={null}
          helperText="These are raw interface-level samples used to build the ranked traffic view above."
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
          tableMinWidthClassName="min-w-[1160px]"
          variant="flush"
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Captured</th>
                <th className="px-4 py-3 text-left font-medium">Interface</th>
                <th className="px-4 py-3 text-left font-medium">Scope</th>
                <th className="px-4 py-3 text-left font-medium">Received</th>
                <th className="px-4 py-3 text-left font-medium">Sent</th>
                <th className="px-4 py-3 text-left font-medium">RX packets</th>
                <th className="px-4 py-3 text-left font-medium">TX packets</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrafficSamples.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  onClick={() => {
                    setSelectedSample(item);
                    setSampleDrawerOpen(true);
                  }}
                >
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
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                      View sample
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <TrafficSampleDetailDrawer
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
