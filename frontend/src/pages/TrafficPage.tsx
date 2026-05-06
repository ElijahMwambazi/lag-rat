import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import DataTableCard from "../components/DataTableCard";
import QueryState from "../components/QueryState";
import StatCard from "../components/StatCard";
import PageFilterBar from "../components/PageFilterBar";
import CollapsibleInspectionSection from "../components/CollapsibleInspectionSection";
import TrafficSampleDetailDrawer from "../components/TrafficSampleDetailDrawer";
import TrafficTalkerDetailDrawer from "../components/TrafficTalkerDetailDrawer";
import InspectionHighlightCard from "../components/InspectionHighlightCard";
import CaptureExportRequestDrawer from "../components/CaptureExportRequestDrawer";
import {
  api,
  type CaptureExportRequest,
  type TrafficSample,
  type TrafficTopTalkerItem,
} from "../services/api";

const WINDOWS = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
];

const TRAFFIC_SAMPLE_PARAM = "trafficSampleId";
const TRAFFIC_TALKER_INTERFACE_PARAM = "trafficTalkerInterface";
const TRAFFIC_TALKER_KEY_PARAM = "trafficTalkerKey";
const CAPTURE_REQUEST_PARAM = "captureRequestId";

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

function formatCaptureSource(value: string) {
  return value.replace(/_/g, " ");
}

function formatCaptureTarget(item: CaptureExportRequest) {
  return (
    item.device_ip_address ??
    item.mac_address ??
    item.entity_key ??
    item.interface_name ??
    "—"
  );
}

function formatCaptureStatus(status: string) {
  switch (status) {
    case "requested":
      return "Requested";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

function getCaptureStatusClasses(status: string) {
  switch (status) {
    case "completed":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
    case "failed":
      return "border-red-800 bg-red-950 text-red-300";
    case "cancelled":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
    case "running":
      return "border-cyan-800 bg-cyan-950 text-cyan-300";
    case "queued":
      return "border-blue-800 bg-blue-950 text-blue-300";
    case "requested":
    default:
      return "border-amber-800 bg-amber-950 text-amber-300";
  }
}

function getCaptureLifecycleTimestamp(item: CaptureExportRequest) {
  switch (item.status) {
    case "queued":
      return item.queued_at ?? item.created_at;
    case "running":
      return item.started_at ?? item.queued_at ?? item.created_at;
    case "completed":
      return item.completed_at ?? item.created_at;
    case "failed":
      return item.failed_at ?? item.created_at;
    case "cancelled":
      return item.cancelled_at ?? item.created_at;
    case "requested":
    default:
      return item.created_at;
  }
}

function getCaptureLifecycleDetail(item: CaptureExportRequest) {
  switch (item.status) {
    case "queued":
      return item.queued_at
        ? `Queued ${formatSampleAge(item.queued_at)}`
        : "Waiting in queue";
    case "running":
      return item.started_at
        ? `Started ${formatSampleAge(item.started_at)}`
        : "Capture worker is running";
    case "completed":
      if (
        item.output_filename &&
        item.file_size_bytes !== null &&
        item.file_size_bytes !== undefined
      ) {
        return `${item.output_filename} · ${formatBytes(item.file_size_bytes)}`;
      }

      return item.capture_reference ?? "Capture reference available";
    case "failed":
      return item.failure_reason ?? "Capture request failed";
    case "cancelled":
      return item.cancelled_at
        ? `Cancelled ${formatSampleAge(item.cancelled_at)}`
        : "Cancelled";
    case "requested":
    default:
      return "Metadata handoff created";
  }
}

function canQueueCaptureRequest(item: CaptureExportRequest) {
  return item.status === "requested";
}

function canCancelCaptureRequest(item: CaptureExportRequest) {
  return ["requested", "queued", "running"].includes(item.status);
}

function getViewingLabel(selectedInterface: string) {
  return selectedInterface || "All interfaces";
}

function getTopTalkerTone(item: TrafficTopTalkerItem) {
  if (item.delta_bytes_total >= 100 * 1024 * 1024) {
    return "critical";
  }

  if (item.delta_bytes_total >= 10 * 1024 * 1024) {
    return "warning";
  }

  if (item.delta_bytes_total === 0) {
    return "stale";
  }

  return "healthy";
}

function getTopTalkerBadgeClasses(tone: string) {
  switch (tone) {
    case "critical":
      return "border-red-800 bg-red-950 text-red-300";
    case "warning":
      return "border-amber-800 bg-amber-950 text-amber-300";
    case "stale":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
    case "healthy":
    default:
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
  }
}

function getTopTalkerStatusLabel(item: TrafficTopTalkerItem) {
  switch (getTopTalkerTone(item)) {
    case "critical":
      return "Heavy mover";
    case "warning":
      return "Active mover";
    case "stale":
      return "No movement";
    case "healthy":
    default:
      return "Moderate movement";
  }
}

export default function TrafficPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [selectedInterface, setSelectedInterface] = useState("");
  const [samplesCollapsed, setSamplesCollapsed] = useState(true);
  const [captureHistoryCollapsed, setCaptureHistoryCollapsed] = useState(true);
  const [pendingDeleteCaptureRequest, setPendingDeleteCaptureRequest] =
    useState<CaptureExportRequest | null>(null);

  const queryClient = useQueryClient();

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

  const captureExportRequestsQuery = useQuery({
    queryKey: ["capture-export-requests", 20],
    queryFn: () => api.getCaptureExportRequests(20),
    refetchInterval: 30000,
  });

  const queueCaptureMutation = useMutation({
    mutationFn: (id: number) => api.queueCaptureExportRequest(id),
    onSuccess: (updated) => {
      const next = new URLSearchParams(searchParams);
      next.set(CAPTURE_REQUEST_PARAM, String(updated.id));
      setSearchParams(next);

      queryClient.invalidateQueries({
        queryKey: ["capture-export-requests"],
      });
    },
  });

  const cancelCaptureMutation = useMutation({
    mutationFn: (id: number) => api.cancelCaptureExportRequest(id),
    onSuccess: (updated) => {
      const next = new URLSearchParams(searchParams);
      next.set(CAPTURE_REQUEST_PARAM, String(updated.id));
      setSearchParams(next);

      queryClient.invalidateQueries({
        queryKey: ["capture-export-requests"],
      });
    },
  });

  const deleteCaptureMutation = useMutation({
    mutationFn: (id: number) => api.deleteCaptureExportRequest(id),
    onSuccess: () => {
      setPendingDeleteCaptureRequest(null);

      const next = new URLSearchParams(searchParams);
      next.delete(CAPTURE_REQUEST_PARAM);
      setSearchParams(next);

      queryClient.invalidateQueries({
        queryKey: ["capture-export-requests"],
      });
    },
  });

  const trafficSamples: TrafficSample[] = trafficSamplesQuery.data ?? [];
  const summary = trafficSummaryQuery.data;
  const topTalkers = topTalkersQuery.data?.items ?? [];
  const captureExportRequests = captureExportRequestsQuery.data ?? [];
  const latestCaptureRequest = captureExportRequests[0] ?? null;

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

  const topTalkerHighlights = useMemo(
    () => filteredTopTalkers.slice(0, 3),
    [filteredTopTalkers],
  );

  const latestSample = filteredTrafficSamples[0] ?? null;

  const selectedSampleId = searchParams.get(TRAFFIC_SAMPLE_PARAM);
  const selectedTalkerInterface = searchParams.get(
    TRAFFIC_TALKER_INTERFACE_PARAM,
  );
  const selectedTalkerKey = searchParams.get(TRAFFIC_TALKER_KEY_PARAM);
  const selectedCaptureRequestId = searchParams.get(CAPTURE_REQUEST_PARAM);

  const selectedSample = useMemo(() => {
    if (!selectedSampleId) {
      return null;
    }

    return (
      trafficSamples.find((item) => String(item.id) === selectedSampleId) ??
      null
    );
  }, [trafficSamples, selectedSampleId]);

  const selectedTalker = useMemo(() => {
    if (!selectedTalkerInterface || !selectedTalkerKey) {
      return null;
    }

    return (
      topTalkers.find(
        (item) =>
          item.interface_name === selectedTalkerInterface &&
          item.entity_key === selectedTalkerKey,
      ) ?? null
    );
  }, [topTalkers, selectedTalkerInterface, selectedTalkerKey]);

  const selectedCaptureRequest = useMemo(() => {
    if (!selectedCaptureRequestId) {
      return null;
    }

    return (
      captureExportRequests.find(
        (item) => String(item.id) === selectedCaptureRequestId,
      ) ?? null
    );
  }, [captureExportRequests, selectedCaptureRequestId]);

  function setSampleDrawerParam(sample: TrafficSample) {
    const next = new URLSearchParams(searchParams);

    next.set(TRAFFIC_SAMPLE_PARAM, String(sample.id));
    next.delete(TRAFFIC_TALKER_INTERFACE_PARAM);
    next.delete(TRAFFIC_TALKER_KEY_PARAM);
    next.delete(CAPTURE_REQUEST_PARAM);

    setSearchParams(next);
  }

  function clearSampleDrawerParam() {
    const next = new URLSearchParams(searchParams);

    next.delete(TRAFFIC_SAMPLE_PARAM);

    setSearchParams(next);
  }

  function setTalkerDrawerParams(talker: TrafficTopTalkerItem) {
    const next = new URLSearchParams(searchParams);

    next.set(TRAFFIC_TALKER_INTERFACE_PARAM, talker.interface_name);
    next.set(TRAFFIC_TALKER_KEY_PARAM, talker.entity_key);
    next.delete(TRAFFIC_SAMPLE_PARAM);
    next.delete(CAPTURE_REQUEST_PARAM);

    setSearchParams(next);
  }

  function clearTalkerDrawerParams() {
    const next = new URLSearchParams(searchParams);

    next.delete(TRAFFIC_TALKER_INTERFACE_PARAM);
    next.delete(TRAFFIC_TALKER_KEY_PARAM);

    setSearchParams(next);
  }

  function setCaptureRequestDrawerParam(request: CaptureExportRequest) {
    const next = new URLSearchParams(searchParams);

    next.set(CAPTURE_REQUEST_PARAM, String(request.id));
    next.delete(TRAFFIC_SAMPLE_PARAM);
    next.delete(TRAFFIC_TALKER_INTERFACE_PARAM);
    next.delete(TRAFFIC_TALKER_KEY_PARAM);

    setSearchParams(next);
  }

  function clearCaptureRequestDrawerParam() {
    const next = new URLSearchParams(searchParams);

    next.delete(CAPTURE_REQUEST_PARAM);

    setSearchParams(next);
  }

  function canDeleteCaptureRequest(item: CaptureExportRequest) {
    return item.status !== "running";
  }

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

      {queueCaptureMutation.isError ? (
        <QueryState
          title="Capture request could not be queued"
          tone="error"
          message={
            queueCaptureMutation.error instanceof Error
              ? queueCaptureMutation.error.message
              : "The capture export request could not be queued."
          }
        />
      ) : null}

      {cancelCaptureMutation.isError ? (
        <QueryState
          title="Capture request could not be cancelled"
          tone="error"
          message={
            cancelCaptureMutation.error instanceof Error
              ? cancelCaptureMutation.error.message
              : "The capture export request could not be cancelled."
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-zinc-200">
                Top talker highlights
              </h4>
              <p className="mt-1 text-xs text-zinc-500">
                Quick cards for the busiest visible interfaces. Select a card to
                open movement details.
              </p>
            </div>
          </div>

          {topTalkersQuery.isLoading ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <InspectionHighlightCard
                  key={index}
                  title="Loading"
                  primaryLabel="Total moved"
                  primaryValue="—"
                  metrics={[
                    { label: "Received", value: "—" },
                    { label: "Sent", value: "—" },
                  ]}
                  footerLabel="Last seen"
                  footerValue="Unknown"
                  className="animate-pulse"
                />
              ))}
            </div>
          ) : null}

          {!topTalkersQuery.isLoading && topTalkerHighlights.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {topTalkerHighlights.map((item) => (
                <InspectionHighlightCard
                  key={`highlight-${item.interface_name}-${item.entity_key}`}
                  ariaLabel={`Inspect top talker ${item.interface_name}`}
                  onClick={() => setTalkerDrawerParams(item)}
                  title={formatInterfaceName(item.interface_name)}
                  subtitle={`${item.entity_type} · ${item.entity_key}`}
                  statusLabel={getTopTalkerStatusLabel(item)}
                  statusBadgeClassName={getTopTalkerBadgeClasses(
                    getTopTalkerTone(item),
                  )}
                  primaryLabel="Total moved"
                  primaryValue={formatBytes(item.delta_bytes_total)}
                  metrics={[
                    {
                      label: "Received",
                      value: formatBytes(item.delta_bytes_rx),
                    },
                    {
                      label: "Sent",
                      value: formatBytes(item.delta_bytes_tx),
                    },
                  ]}
                  footerLabel="Last seen"
                  footerValue={formatSampleAge(item.latest_sampled_at)}
                  actionHint="Opens details"
                />
              ))}
            </div>
          ) : null}
        </div>

        <DataTableCard
          title="Top talkers"
          description="Ranked by byte movement between the earliest and latest samples in the selected window."
          rightSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                Ranked table
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {filteredTopTalkers.length} item
                {filteredTopTalkers.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                {formatBytes(totalDeltaBytes)} moved
              </span>
            </div>
          }
          helperText="Full ranked view for the selected scope. Use this table to compare all visible interfaces and open detailed movement history."
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
          tableMinWidthClassName="min-w-[1160px]"
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
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredTopTalkers.map((item) => (
                <tr
                  key={`${item.interface_name}-${item.entity_key}`}
                  className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  onClick={() => setTalkerDrawerParams(item)}
                >
                  <td className="px-4 py-3 text-zinc-100">
                    <div>{formatInterfaceName(item.interface_name)}</div>
                    <div className="mt-1">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${getTopTalkerBadgeClasses(
                          getTopTalkerTone(item),
                        )}`}
                      >
                        {getTopTalkerStatusLabel(item)}
                      </span>
                    </div>
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
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                      Inspect
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TrafficTalkerDetailDrawer
            talker={selectedTalker}
            windowMinutes={windowMinutes}
            open={!!selectedTalker}
            onClose={clearTalkerDrawerParams}
          />
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
          !!selectedSample ||
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
          helperText="Raw interface-level captures that feed the ranked traffic view above."
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
          hideHeader
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
                  onClick={() => setSampleDrawerParam(item)}
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
                      Inspect
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TrafficSampleDetailDrawer
            sample={selectedSample}
            windowMinutes={windowMinutes}
            open={!!selectedSample}
            onClose={clearSampleDrawerParam}
          />
        </DataTableCard>
      </CollapsibleInspectionSection>

      <CollapsibleInspectionSection
        title="Capture export requests"
        description="Metadata handoff records for packet-capture work that should be inspected externally with tools like tcpdump or Wireshark."
        badges={
          <>
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              {captureExportRequests.length} request
              {captureExportRequests.length === 1 ? "" : "s"}
            </span>

            {latestCaptureRequest ? (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                Latest · {formatSampleAge(latestCaptureRequest.created_at)}
              </span>
            ) : null}
          </>
        }
        collapsedSummary={
          captureExportRequests.length === 0
            ? "No capture export requests have been created yet."
            : `${captureExportRequests.length} capture export request${
                captureExportRequests.length === 1 ? "" : "s"
              } recorded. Latest target: ${
                latestCaptureRequest
                  ? formatCaptureTarget(latestCaptureRequest)
                  : "—"
              }.`
        }
        collapsedDetail="Expand this section to review capture handoff metadata. Lag Rat records request context but does not inspect packet contents."
        collapsedActionLabel="Show capture requests"
        expandedActionLabel="Hide capture requests"
        isExpanded={
          !captureHistoryCollapsed ||
          !!selectedCaptureRequest ||
          captureExportRequestsQuery.isLoading ||
          captureExportRequestsQuery.isError
        }
        onToggle={() => setCaptureHistoryCollapsed((current) => !current)}
      >
        <DataTableCard
          title="Capture export requests"
          description="Recent capture handoff requests created from traffic drawers."
          rightSlot={null}
          helperText="These records are metadata handoffs only. Use external tooling for packet-level inspection."
          isLoading={captureExportRequestsQuery.isLoading}
          isError={captureExportRequestsQuery.isError}
          errorMessage={
            captureExportRequestsQuery.error instanceof Error
              ? captureExportRequestsQuery.error.message
              : "Capture export requests could not be loaded."
          }
          emptyTitle="Capture export requests"
          emptyMessage="No capture export requests have been created yet."
          hasData={captureExportRequests.length > 0}
          tableMinWidthClassName="min-w-[1280px]"
          variant="flush"
          hideHeader
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Interface</th>
                <th className="px-4 py-3 text-left font-medium">Target</th>
                <th className="px-4 py-3 text-left font-medium">Window</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Lifecycle</th>
                <th className="px-4 py-3 text-left font-medium">Note</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {captureExportRequests.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  onClick={() => setCaptureRequestDrawerParam(item)}
                >
                  <td className="px-4 py-3 text-zinc-300">
                    <div>{formatDate(item.created_at)}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatSampleAge(item.created_at)}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    {formatCaptureSource(item.source)}
                  </td>

                  <td className="px-4 py-3 text-zinc-100">
                    {formatInterfaceName(item.interface_name)}
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    <div>{formatCaptureTarget(item)}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.entity_type ?? "unknown"}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    {item.window_minutes ? `${item.window_minutes}m` : "—"}
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        getCaptureStatusClasses(item.status),
                      ].join(" ")}
                    >
                      {formatCaptureStatus(item.status)}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    <div>{formatDate(getCaptureLifecycleTimestamp(item))}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {getCaptureLifecycleDetail(item)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {item.note ?? "—"}
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCaptureRequestDrawerParam(item);
                      }}
                      className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:bg-zinc-900"
                    >
                      Inspect
                    </button>
                  </td>

                  <td className="px-4 py-3 text-zinc-300">
                    <div className="flex flex-wrap items-center gap-2">
                      {canQueueCaptureRequest(item) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            queueCaptureMutation.mutate(item.id);
                          }}
                          disabled={queueCaptureMutation.isPending}
                          className="rounded-full border border-cyan-800 bg-cyan-950 px-2 py-0.5 text-[11px] text-cyan-200 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Queue
                        </button>
                      ) : null}

                      {canCancelCaptureRequest(item) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            cancelCaptureMutation.mutate(item.id);
                          }}
                          disabled={cancelCaptureMutation.isPending}
                          className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      ) : null}

                      {deleteCaptureMutation.isError ? (
                        <QueryState
                          title="Capture request could not be deleted"
                          tone="error"
                          message={
                            deleteCaptureMutation.error instanceof Error
                              ? deleteCaptureMutation.error.message
                              : "The capture export request could not be deleted."
                          }
                        />
                      ) : null}

                      {canDeleteCaptureRequest(item) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDeleteCaptureRequest(item);
                          }}
                          disabled={deleteCaptureMutation.isPending}
                          className="rounded-full border border-red-900 bg-red-950 px-2 py-0.5 text-[11px] text-red-200 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      ) : null}

                      {!canQueueCaptureRequest(item) &&
                      !canCancelCaptureRequest(item) &&
                      !canDeleteCaptureRequest(item) ? (
                        <span className="text-xs text-zinc-500">No action</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <CaptureExportRequestDrawer
            request={selectedCaptureRequest}
            open={!!selectedCaptureRequest}
            onClose={clearCaptureRequestDrawerParam}
            onQueue={(request) => queueCaptureMutation.mutate(request.id)}
            onCancel={(request) => cancelCaptureMutation.mutate(request.id)}
            onDelete={(request) => setPendingDeleteCaptureRequest(request)}
            queuePending={queueCaptureMutation.isPending}
            cancelPending={cancelCaptureMutation.isPending}
            deletePending={deleteCaptureMutation.isPending}
          />
        </DataTableCard>
      </CollapsibleInspectionSection>

      {pendingDeleteCaptureRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Delete capture request?
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  This removes the capture request from Lag Rat history. If the
                  request has a local capture file reference, Lag Rat will also
                  try to remove that local .pcap file.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPendingDeleteCaptureRequest(null)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Source
                  </div>
                  <div className="mt-1 text-zinc-200">
                    {formatCaptureSource(pendingDeleteCaptureRequest.source)}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Target
                  </div>
                  <div className="mt-1 text-zinc-200">
                    {formatCaptureTarget(pendingDeleteCaptureRequest)}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Status
                  </div>
                  <div className="mt-1 text-zinc-200">
                    {formatCaptureStatus(pendingDeleteCaptureRequest.status)}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Created
                  </div>
                  <div className="mt-1 text-zinc-200">
                    {formatDate(pendingDeleteCaptureRequest.created_at)}
                  </div>
                </div>
              </div>

              {pendingDeleteCaptureRequest.capture_reference ? (
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Capture reference
                  </div>
                  <div className="mt-1 break-all text-zinc-200">
                    {pendingDeleteCaptureRequest.capture_reference}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteCaptureRequest(null)}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  deleteCaptureMutation.mutate(pendingDeleteCaptureRequest.id)
                }
                disabled={deleteCaptureMutation.isPending}
                className="rounded-xl border border-red-900 bg-red-950 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteCaptureMutation.isPending
                  ? "Deleting..."
                  : "Delete capture request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
