import { useQuery } from "@tanstack/react-query";
import ChartCard from "../components/ChartCard";
import QueryState from "../components/QueryState";
import { api } from "../services/api";

export default function MetricsPage() {
  const healthHistoryQuery = useQuery({
    queryKey: ["health-history"],
    queryFn: api.getHealthHistory,
    refetchInterval: 30000,
  });
  const dnsHistoryQuery = useQuery({
    queryKey: ["dns-history"],
    queryFn: api.getDnsHistory,
    refetchInterval: 30000,
  });

  const allFailed = healthHistoryQuery.isError && dnsHistoryQuery.isError;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold">Metrics</h2>
        <p className="mt-2 text-zinc-400">Latency and DNS response trends from SQLite-backed probe data.</p>
      </section>

      {allFailed ? (
        <QueryState
          title="Metrics requests failed"
          tone="error"
          message="Both metrics endpoints failed. Check the backend and API base URL."
        />
      ) : null}

      <ChartCard
        title="Internet Latency (ms)"
        data={healthHistoryQuery.data ?? []}
        isLoading={healthHistoryQuery.isLoading}
        isError={healthHistoryQuery.isError}
        errorMessage={
          healthHistoryQuery.error instanceof Error
            ? healthHistoryQuery.error.message
            : "Internet latency request failed."
        }
      />

      <ChartCard
        title="DNS Response Time (ms)"
        data={dnsHistoryQuery.data ?? []}
        isLoading={dnsHistoryQuery.isLoading}
        isError={dnsHistoryQuery.isError}
        errorMessage={
          dnsHistoryQuery.error instanceof Error
            ? dnsHistoryQuery.error.message
            : "DNS history request failed."
        }
      />
    </div>
  );
}
