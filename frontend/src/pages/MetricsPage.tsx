import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";

export default function MetricsPage() {
  const healthHistoryQuery = useQuery({ queryKey: ["health-history"], queryFn: api.getHealthHistory, refetchInterval: 30000 });
  const dnsHistoryQuery = useQuery({ queryKey: ["dns-history"], queryFn: api.getDnsHistory, refetchInterval: 30000 });

  return (
    <div className="space-y-8">
      <section><h2 className="text-2xl font-semibold">Metrics</h2><p className="mt-2 text-zinc-400">Latency and DNS response trends from SQLite-backed probe data.</p></section>
      <ChartCard title="Internet Latency (ms)" data={healthHistoryQuery.data ?? []} />
      <ChartCard title="DNS Response Time (ms)" data={dnsHistoryQuery.data ?? []} />
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: Array<{ timestamp: string; value: number }> }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h3 className="mb-4 text-lg font-medium">{title}</h3><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={[...data].reverse()}><XAxis dataKey="timestamp" hide /><YAxis /><Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} /><Line type="monotone" dataKey="value" dot={false} stroke="currentColor" /></LineChart></ResponsiveContainer></div></div>;
}
