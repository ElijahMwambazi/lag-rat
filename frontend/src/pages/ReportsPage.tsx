import { useQuery } from "@tanstack/react-query";
import QueryState from "../components/QueryState";
import { api } from "../services/api";

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined)
    return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

export default function ReportsPage() {
  const outagesQuery = useQuery({
    queryKey: ["outages"],
    queryFn: api.getOutages,
    refetchInterval: 60000,
  });

  const outages = outagesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">
        Reports
      </h2>

      {outagesQuery.isError ? (
        <QueryState
          title="Reports request failed"
          tone="error"
          message={
            outagesQuery.error instanceof Error
              ? outagesQuery.error.message
              : "The outages endpoint failed."
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left">
                Type
              </th>
              <th className="px-4 py-3 text-left">
                Target
              </th>
              <th className="px-4 py-3 text-left">
                Started
              </th>
              <th className="px-4 py-3 text-left">
                Ended
              </th>
              <th className="px-4 py-3 text-left">
                Duration
              </th>
              <th className="px-4 py-3 text-left">
                Status
              </th>
              <th className="px-4 py-3 text-left">
                Error
              </th>
            </tr>
          </thead>
          <tbody>
            {outagesQuery.isLoading &&
            outages.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-zinc-400"
                >
                  Loading outages...
                </td>
              </tr>
            ) : outages.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-zinc-400"
                >
                  No outages recorded yet.
                </td>
              </tr>
            ) : (
              outages.map((outage) => (
                <tr
                  key={`${outage.id}-${outage.started_at}-${outage.target}`}
                  className="border-t border-zinc-800"
                >
                  <td className="px-4 py-3">
                    {outage.outage_type || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {outage.target}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(
                      outage.started_at,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(outage.ended_at)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDuration(
                      outage.duration_seconds,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {outage.status}
                  </td>
                  <td className="px-4 py-3">
                    {outage.start_error ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
