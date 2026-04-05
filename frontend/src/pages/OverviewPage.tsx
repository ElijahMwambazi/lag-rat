import { useQuery } from "@tanstack/react-query";
import StatCard from "../components/StatCard";
import { api } from "../services/api";

function formatDate(value?: string) {
  if (!value) return "Loading...";
  return new Date(value).toLocaleString();
}

export default function OverviewPage() {
  const healthQuery = useQuery({
    queryKey: ["health-current"],
    queryFn: api.getCurrentHealth,
    refetchInterval: 15000,
  });
  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: api.getSummary,
    refetchInterval: 30000,
  });

  const health = healthQuery.data;
  const summary = summaryQuery.data;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="mt-2 text-zinc-400">Current health snapshot for your network.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Router"
          value={health?.router_reachable ? "Reachable" : "Down"}
          hint={health ? `Gateway ${health.router_ip}` : "Loading..."}
        />
        <StatCard
          label="Internet"
          value={health?.internet_reachable ? "Online" : "Offline"}
          hint={health ? `Last checked ${formatDate(health.checked_at)}` : undefined}
        />
        <StatCard
          label="DNS"
          value={health?.dns_healthy ? "Healthy" : "Unhealthy"}
          hint={health ? `Last checked ${formatDate(health.checked_at)}` : undefined}
        />
        <StatCard
          label="24h Uptime"
          value={summary ? `${summary.uptime_pct_24h.toFixed(1)}%` : "—"}
          hint={summary ? `${summary.outage_count_24h} outages` : undefined}
        />
      </section>
    </div>
  );
}
