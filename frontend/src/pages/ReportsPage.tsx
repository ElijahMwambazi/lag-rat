import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QueryState from "../components/QueryState";
import { api, Outage } from "../services/api";

type StatusFilter = "all" | "active" | "resolved";
type TypeFilter =
  | "all"
  | "internet_http"
  | "internet_tcp"
  | "dns"
  | "router";

type SortKey =
  | "started_desc"
  | "started_asc"
  | "duration_desc"
  | "duration_asc";

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined)
    return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
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
  const [selectedOutage, setSelectedOutage] =
    useState<Outage | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>(
    "started_desc",
  );

  const outagesQuery = useQuery({
    queryKey: [
      "outages",
      statusFilter,
      typeFilter,
      search,
      sortBy,
    ],
    queryFn: () =>
      api.getOutages({
        status:
          statusFilter === "all"
            ? undefined
            : statusFilter,
        outage_type:
          typeFilter === "all"
            ? undefined
            : typeFilter,
        search: search.trim() || undefined,
        limit: 200,
      }),
    refetchInterval: 60000,
  });

  const outages = outagesQuery.data ?? [];

  const visibleOutages = useMemo(() => {
    return [...outages].sort((a, b) => {
      if (sortBy === "started_asc") {
        return (
          new Date(a.started_at).getTime() -
          new Date(b.started_at).getTime()
        );
      }

      if (sortBy === "duration_desc") {
        return (
          (b.duration_seconds ?? -1) -
          (a.duration_seconds ?? -1)
        );
      }

      if (sortBy === "duration_asc") {
        return (
          (a.duration_seconds ??
            Number.MAX_SAFE_INTEGER) -
          (b.duration_seconds ??
            Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        new Date(b.started_at).getTime() -
        new Date(a.started_at).getTime()
      );
    });
  }, [outages, sortBy]);

  const filteredOutages = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = outages.filter((outage) => {
      if (
        statusFilter !== "all" &&
        outage.status !== statusFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        outage.outage_type !== typeFilter
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [
        outage.outage_type,
        outage.target,
        outage.status,
        outage.start_error,
        outage.end_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "started_asc") {
        return (
          new Date(a.started_at).getTime() -
          new Date(b.started_at).getTime()
        );
      }

      if (sortBy === "duration_desc") {
        return (
          (b.duration_seconds ?? -1) -
          (a.duration_seconds ?? -1)
        );
      }

      if (sortBy === "duration_asc") {
        return (
          (a.duration_seconds ??
            Number.MAX_SAFE_INTEGER) -
          (b.duration_seconds ??
            Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        new Date(b.started_at).getTime() -
        new Date(a.started_at).getTime()
      );
    });

    return sorted;
  }, [
    outages,
    search,
    statusFilter,
    typeFilter,
    sortBy,
  ]);

  const activeCount = outages.filter(
    (outage) => outage.status === "active",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Reports
          </h2>
        </div>

        <p className="text-sm text-zinc-400">
          {outagesQuery.isLoading
            ? "Loading..."
            : `${filteredOutages.length} shown · ${outages.length} total · ${activeCount} active`}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search target, type, status, error..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:min-w-[320px]"
          />

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(
                e.target.value as TypeFilter,
              )
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value="all">All types</option>
            <option value="internet_http">
              internet_http
            </option>
            <option value="internet_tcp">
              internet_tcp
            </option>
            <option value="dns">dns</option>
            <option value="router">router</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as StatusFilter,
              )
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value="all">
              All statuses
            </option>
            <option value="active">Active</option>
            <option value="resolved">
              Resolved
            </option>
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as SortKey)
            }
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value="started_desc">
              Newest first
            </option>
            <option value="started_asc">
              Oldest first
            </option>
            <option value="duration_desc">
              Longest duration
            </option>
            <option value="duration_asc">
              Shortest duration
            </option>
          </select>
        </div>
      </div>

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
            ) : filteredOutages.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-zinc-400"
                >
                  No reports match the current
                  filters.
                </td>
              </tr>
            ) : (
              filteredOutages.map((outage) => (
                <tr
                  key={`${outage.id}-${outage.started_at}-${outage.target}`}
                  className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
                  onClick={() =>
                    setSelectedOutage(outage)
                  }
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
                    <span
                      className={
                        outage.status === "active"
                          ? "rounded-full border border-red-800 bg-red-950 px-2 py-0.5 text-xs text-red-300"
                          : "rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300"
                      }
                    >
                      {outage.status}
                    </span>
                  </td>
                  <td className="max-w-[420px] px-4 py-3 text-zinc-300">
                    <div
                      className="truncate"
                      title={
                        outage.start_error ?? "—"
                      }
                    >
                      {outage.start_error ?? "—"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedOutage ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-zinc-100">
                  {selectedOutage.outage_type}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Outage details
                </p>
              </div>

              <button
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() =>
                  setSelectedOutage(null)
                }
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Target
                </div>
                <div className="mt-2 text-zinc-100 break-all">
                  {selectedOutage.target}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Started
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {formatDate(
                      selectedOutage.started_at,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Ended
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {formatDate(
                      selectedOutage.ended_at,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Duration
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {formatDuration(
                      selectedOutage.duration_seconds,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Status
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {selectedOutage.status}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Error
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
                  {selectedOutage.start_error ??
                    "—"}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Recovery note
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
                  {selectedOutage.end_note ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
