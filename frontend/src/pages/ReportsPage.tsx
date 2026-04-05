import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export default function ReportsPage() {
  const outagesQuery = useQuery({
    queryKey: ["outages"],
    queryFn: api.getOutages,
    refetchInterval: 60000,
  });

  const outages = outagesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Reports</h2>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Target</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Ended</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {outages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-zinc-400">No outages recorded yet.</td>
              </tr>
            ) : (
              outages.map((outage) => (
                <tr key={outage.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">{outage.outage_type}</td>
                  <td className="px-4 py-3">{outage.target}</td>
                  <td className="px-4 py-3">{new Date(outage.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{outage.ended_at ? new Date(outage.ended_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">{outage.is_active ? "Active" : "Resolved"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
