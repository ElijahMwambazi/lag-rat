import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import { api } from "../services/api";

export default function MetricsPage() {
  const httpQuery = useQuery({ queryKey: ["health-history"], queryFn: api.getHealthHistory, refetchInterval: 30000 });
  const tcpQuery = useQuery({ queryKey: ["health-history-tcp"], queryFn: api.getHealthHistoryTcp, refetchInterval: 30000 });
  const dnsQuery = useQuery({ queryKey: ["dns-history"], queryFn: api.getDnsHistory, refetchInterval: 30000 });

  const allFailed = httpQuery.isError && tcpQuery.isError && dnsQuery.isError;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold">Metrics</h2>
        <p className="mt-2 text-zinc-400">Latency and DNS response trends from SQLite-backed probe data.</p>
      </section>

      {allFailed ? <QueryState title="Metrics requests failed" tone="error" message="All metrics endpoints failed. Check the backend and API base URL." /> : null}

      <ChartCard title="Internet HTTP Latency (ms)" data={httpQuery.data ?? []} isLoading={httpQuery.isLoading} isError={httpQuery.isError} errorMessage={httpQuery.error instanceof Error ? httpQuery.error.message : "Internet HTTP request failed."} />
      <ChartCard title="Internet TCP Latency (ms)" data={tcpQuery.data ?? []} isLoading={tcpQuery.isLoading} isError={tcpQuery.isError} errorMessage={tcpQuery.error instanceof Error ? tcpQuery.error.message : "Internet TCP request failed."} />
      <ChartCard title="DNS Response Time (ms)" data={dnsQuery.data ?? []} isLoading={dnsQuery.isLoading} isError={dnsQuery.isError} errorMessage={dnsQuery.error instanceof Error ? dnsQuery.error.message : "DNS history request failed."} />
    </div>
  );
}
