import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  api,
  type Alert,
  type AlertHistoryItem,
} from "../services/api";
import AlertDetailDrawer from "./AlertDetailDrawer";

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
type AlertsPanelFocusMode =
  | "default"
  | "active-critical";

const NOTIFIED_ALERT_IDS_STORAGE_KEY =
  "lag-rat:notified-critical-alert-ids";
const MAX_STORED_ALERT_IDS = 500;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatAlertEventType(eventType: string) {
  switch (eventType) {
    case "opened":
      return "Opened";
    case "severity_changed":
      return "Severity changed";
    case "message_changed":
      return "Message changed";
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function formatAlertEventSummary(
  item: AlertHistoryItem,
) {
  switch (item.event_type) {
    case "opened":
      return item.new_value
        ? `Initial severity: ${item.new_value}`
        : "Alert opened";

    case "severity_changed":
      return item.previous_value && item.new_value
        ? `${item.previous_value} → ${item.new_value}`
        : "Severity changed";

    case "message_changed":
      return item.previous_value && item.new_value
        ? `Previous: ${item.previous_value}\nNew: ${item.new_value}`
        : "Message updated";

    case "acknowledged":
      return "Marked as acknowledged";

    case "resolved":
      return item.previous_value && item.new_value
        ? `${item.previous_value} → ${item.new_value}`
        : "Alert resolved";

    default:
      if (item.previous_value || item.new_value) {
        return `${item.previous_value ?? "—"} → ${item.new_value ?? "—"}`;
      }

      return null;
  }
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

function readNotifiedAlertIds(): number[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(
      NOTIFIED_ALERT_IDS_STORAGE_KEY,
    );

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
}

function writeNotifiedAlertIds(ids: Set<number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const trimmed = Array.from(ids).slice(
      -MAX_STORED_ALERT_IDS,
    );

    window.localStorage.setItem(
      NOTIFIED_ALERT_IDS_STORAGE_KEY,
      JSON.stringify(trimmed),
    );
  } catch {
    // ignore storage failures
  }
}

export default function AlertsPanel({
  focusMode = "default",
}: {
  focusMode?: AlertsPanelFocusMode;
}) {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [entityFilter, setEntityFilter] =
    useState<EntityFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedAlert, setSelectedAlert] =
    useState<Alert | null>(null);
  const notifiedAlertIdsRef = useRef<Set<number>>(
    new Set(readNotifiedAlertIds()),
  );

  const [
    notificationsEnabled,
    setNotificationsEnabled,
  ] = useState<boolean>(
    typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  );

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

  const alertHistoryQuery = useQuery({
    queryKey: [
      "alert-history",
      selectedAlert?.id,
    ],
    queryFn: () =>
      api.getAlertHistory(selectedAlert!.id),
    enabled: !!selectedAlert,
  });

  const activeCount = useMemo(
    () =>
      alerts.filter((alert) => alert.is_active)
        .length,
    [alerts],
  );

  const queryClient = useQueryClient();

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) =>
      api.acknowledgeAlert(id),
    onSuccess: (updatedAlert) => {
      setSelectedAlert(updatedAlert);

      queryClient.setQueriesData(
        { queryKey: ["alerts"] },
        (oldData: Alert[] | undefined) =>
          oldData?.map((alert) =>
            alert.id === updatedAlert.id
              ? updatedAlert
              : alert,
          ) ?? oldData,
      );

      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "alert-history",
          updatedAlert.id,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: ["status-overview"],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "alerts",
          "critical",
          "active",
          "overview",
        ],
      });
    },
  });

  useEffect(() => {
    if (focusMode === "active-critical") {
      setStatusFilter("active");
      setSeverityFilter("critical");
    }
  }, [focusMode]);

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

  useEffect(() => {
    if (typeof Notification === "undefined") {
      return;
    }

    const activeCriticalAlerts = alerts.filter(
      (alert) =>
        alert.is_active &&
        alert.severity === "critical",
    );

    let didPersist = false;

    for (const alert of activeCriticalAlerts) {
      const alreadyNotified =
        notifiedAlertIdsRef.current.has(alert.id);

      if (alreadyNotified) {
        continue;
      }

      notifiedAlertIdsRef.current.add(alert.id);
      didPersist = true;

      if (Notification.permission === "granted") {
        new Notification(
          "Lag Rat critical alert",
          {
            body: `${alert.entity_type}: ${alert.message}`,
          },
        );
      }
    }

    if (didPersist) {
      writeNotifiedAlertIds(
        notifiedAlertIdsRef.current,
      );
    }
  }, [alerts]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      return;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    setNotificationsEnabled(
      permission === "granted",
    );
  }

  return (
    <>
      <section className="flex h-[32rem] min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">
              Alerts
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {typeof Notification !==
              "undefined" &&
            Notification.permission !==
              "granted" ? (
              <button
                type="button"
                onClick={enableNotifications}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Enable notifications
              </button>
            ) : notificationsEnabled ? (
              <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs text-emerald-300">
                Notifications on
              </span>
            ) : null}

            <p className="text-sm text-zinc-400">
              {alertsQuery.isLoading
                ? "Loading..."
                : `${visibleAlerts.length} shown · ${activeCount} active`}
            </p>
          </div>
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
                      {alert.is_active &&
                      alert.acknowledged_at ? (
                        <span className="rounded-full border border-amber-800 bg-amber-950 px-2.5 py-1 text-xs text-amber-300">
                          Acknowledged
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <AlertDetailDrawer
        alert={selectedAlert}
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        history={alertHistoryQuery.data ?? []}
        historyLoading={
          alertHistoryQuery.isLoading
        }
        historyError={alertHistoryQuery.isError}
        acknowledgePending={
          acknowledgeMutation.isPending
        }
        acknowledgeErrorMessage={
          acknowledgeMutation.isError
            ? acknowledgeMutation.error instanceof
              Error
              ? acknowledgeMutation.error.message
              : "Failed to acknowledge alert."
            : null
        }
        onAcknowledge={(id) =>
          acknowledgeMutation.mutate(id)
        }
      />
    </>
  );
}
