import { useQuery } from "@tanstack/react-query";
import IssuePanel from "../components/IssuePanel";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatMs(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)} ms`;
}

export default function OverviewPage() {
  const overviewQuery = useQuery({
    queryKey: ["status-overview"],
    queryFn: api.getStatusOverview,
    refetchInterval: 15000,
  });
  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: api.getSummary,
    refetchInterval: 30000,
  });

  const overview = overviewQuery.data;
  const summary = summaryQuery.data;

  const issues = [];
  if (overview && !overview.router.is_healthy) {
    issues.push({
      title: "Router connectivity issue",
      detail: overview.router.latest_error_message ?? "Router reachability is failing.",
    });
  }
  if (overview && !overview.internet.is_healthy) {
    issues.push({
      title: "Internet connectivity issue",
      detail: overview.internet.latest_error_message ?? "Public probe is failing.",
    });
  }
  if (overview && !overview.dns.is_healthy) {
    issues.push({
      title: "DNS health issue",
      detail: overview.dns.latest_error_message ?? "DNS resolution is failing.",
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Overview</h2>
            <p className="mt-2 text-zinc-400">Current health snapshot for your network.</p>
          </div>
          {overview ? <p className="text-sm text-zinc-400">Last check {formatDate(overview.checked_at)}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Router"
          value={overview ? (overview.router.is_healthy ? "Reachable" : "Down") : "—"}
          hint={overview ? `Latency ${formatMs(overview.router.latest_latency_ms)}` : "Loading..."}
        />
        <StatCard
          label="Internet"
          value={overview ? (overview.internet.is_healthy ? "Online" : "Offline") : "—"}
          hint={overview ? `Latency ${formatMs(overview.internet.latest_latency_ms)}` : "Loading..."}
        />
        <StatCard
          label="DNS"
          value={overview ? (overview.dns.is_healthy ? "Healthy" : "Unhealthy") : "—"}
          hint={overview ? `Response ${formatMs(overview.dns.latest_response_time_ms)}` : "Loading..."}
        />
        <StatCard
          label="24h Uptime"
          value={summary ? `${summary.uptime_pct_24h.toFixed(1)}%` : "—"}
          hint={summary ? `${summary.outage_count_24h} outages` : undefined}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Router status</h3>
            {overview ? <StatusBadge ok={overview.router.is_healthy} activeOutage={overview.router.active_outage} /> : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Last success: <span className="text-zinc-400">{formatDate(overview?.router.last_success_at)}</span></p>
            <p>Last failure: <span className="text-zinc-400">{formatDate(overview?.router.last_failure_at)}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Internet status</h3>
            {overview ? <StatusBadge ok={overview.internet.is_healthy} activeOutage={overview.internet.active_outage} /> : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Last success: <span className="text-zinc-400">{formatDate(overview?.internet.last_success_at)}</span></p>
            <p>Last failure: <span className="text-zinc-400">{formatDate(overview?.internet.last_failure_at)}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">DNS status</h3>
            {overview ? <StatusBadge ok={overview.dns.is_healthy} activeOutage={overview.dns.active_outage} /> : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Last success: <span className="text-zinc-400">{formatDate(overview?.dns.last_success_at)}</span></p>
            <p>Last failure: <span className="text-zinc-400">{formatDate(overview?.dns.last_failure_at)}</span></p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="Active outages"
          value={overview ? String(overview.outages.active_count) : "—"}
          hint={overview ? `${overview.outages.last_24h_count} in last 24h` : undefined}
        />
        <StatCard
          label="Devices seen (24h)"
          value={overview ? String(overview.devices.active_count_24h) : "—"}
          hint={overview ? `Last seen ${formatDate(overview.devices.most_recent_seen_at)}` : undefined}
        />
        <StatCard
          label="Last overall check"
          value={overview ? formatDate(overview.checked_at) : "—"}
        />
      </section>

      <IssuePanel issues={issues} />
    </div>
  );
}
