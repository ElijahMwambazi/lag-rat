import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Alert } from "../services/api";

type StatusFilter = "all" | "active" | "resolved";
type SeverityFilter =
  | "all"
  | "critical"
  | "warning"
  | "info";
type EntityFilter =
  | "all"
  | "router"
  | "internet"
  | "dns";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function severityClasses(severity: string) {
  if (severity === "critical") {
    return "border-red-800 bg-red-950 text-red-300";
  }
  if (severity === "warning") {
    return "border-amber-800 bg-amber-950 text-amber-300";
  }
  if (severity === "info") {
    return "border-sky-800 bg-sky-950 text-sky-300";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-300";
}

export default function AlertsPanel() {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [entityFilter, setEntityFilter] =
    useState<EntityFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedAlert, setSelectedAlert] =
    useState<Alert | null>(null);

  const alertsQuery = useQuery({
    queryKey: [
      "alerts",
      statusFilter,
      severityFilter,
      entityFilter,
      search,
    ],
    queryFn: () =>
      api.getAlerts({
        status:
          statusFilter === "all"
            ? undefined
            : statusFilter,
        severity:
          severityFilter === "all"
            ? undefined
            : severityFilter,
        entity_type:
          entityFilter === "all"
            ? undefined
            : entityFilter,
        search: search.trim() || undefined,
        limit: 100,
      }),
    refetchInterval: 60000,
  });

  const alerts = alertsQuery.data ?? [];

  const activeCount = useMemo(
    () =>
      alerts.filter((alert) => alert.is_active)
        .length,
    [alerts],
  );

  const visibleAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [alerts]);

  return (
    <>
      <section className="flex h-[32rem] min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">
              Alerts
            </h3>
          </div>

          <p className="text-sm text-zinc-400">
            {alertsQuery.isLoading
              ? "Loading..."
              : `${visibleAlerts.length} shown · ${activeCount} active`}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search message, entity, type..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as StatusFilter,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="all">
                All statuses
              </option>
              <option value="active">
                Active
              </option>
              <option value="resolved">
                Resolved
              </option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(
                  e.target
                    .value as SeverityFilter,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="all">
                All severities
              </option>
              <option value="critical">
                critical
              </option>
              <option value="warning">
                warning
              </option>
              <option value="info">info</option>
            </select>

            <select
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(
                  e.target.value as EntityFilter,
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="all">
                All entities
              </option>
              <option value="router">
                router
              </option>
              <option value="internet">
                internet
              </option>
              <option value="dns">dns</option>
            </select>
          </div>
        </div>

        {alertsQuery.isError ? (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {alertsQuery.error instanceof Error
              ? alertsQuery.error.message
              : "The alerts endpoint failed."}
          </div>
        ) : null}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {alertsQuery.isLoading &&
          visibleAlerts.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Loading alerts...
            </p>
          ) : visibleAlerts.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No alerts match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left transition-colors hover:bg-zinc-800/60"
                  onClick={() =>
                    setSelectedAlert(alert)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-zinc-100">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {alert.entity_type} ·{" "}
                        {alert.alert_type} ·{" "}
                        {formatDate(
                          alert.created_at,
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${severityClasses(
                          alert.severity,
                        )}`}
                      >
                        {alert.severity}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          alert.is_active
                            ? "border-red-800 bg-red-950 text-red-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {alert.is_active
                          ? "Active"
                          : "Resolved"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedAlert ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-zinc-100">
                  Alert details
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedAlert.alert_type}
                </p>
              </div>

              <button
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() =>
                  setSelectedAlert(null)
                }
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Message
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
                  {selectedAlert.message}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Entity type
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {selectedAlert.entity_type}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Entity key
                  </div>
                  <div className="mt-2 break-all text-zinc-100">
                    {selectedAlert.entity_key}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Severity
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {selectedAlert.severity}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Status
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {selectedAlert.is_active
                      ? "Active"
                      : "Resolved"}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Created
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {formatDate(
                      selectedAlert.created_at,
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Resolved
                  </div>
                  <div className="mt-2 text-zinc-100">
                    {formatDate(
                      selectedAlert.resolved_at,
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
