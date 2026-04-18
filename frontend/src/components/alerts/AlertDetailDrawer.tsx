import type {
  Alert,
  AlertHistoryItem,
} from "../../services/api";
import SideDrawer from "../SideDrawer";
import DrawerDetailSection from "../DrawerDetailSection";
import {
  buildAlertHeadline,
  buildAlertSubtext,
  formatIncidentState,
  formatIncidentType,
} from "../../utils/incidentText";

type Props = {
  alert: Alert | null;
  open: boolean;
  onClose: () => void;
  history: AlertHistoryItem[];
  historyLoading?: boolean;
  historyError?: boolean;
  acknowledgePending?: boolean;
  acknowledgeErrorMessage?: string | null;
  onAcknowledge: (id: number) => void;
};

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

export default function AlertDetailDrawer({
  alert,
  open,
  onClose,
  history,
  historyLoading = false,
  historyError = false,
  acknowledgePending = false,
  acknowledgeErrorMessage,
  onAcknowledge,
}: Props) {
  async function copyText(value?: string | null) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures for now
    }
  }

  if (!open || !alert) {
    return null;
  }

  const headline = buildAlertHeadline({
    entityType: alert.entity_type,
    entityKey: alert.entity_key,
    message: alert.message,
  });

  const subtext = buildAlertSubtext({
    entityType: alert.entity_type,
    entityKey: alert.entity_key,
    message: alert.message,
  });

  const isActiveUnacknowledged =
    alert.is_active && !alert.acknowledged_at;

  return (
    <SideDrawer
      open={open}
      title={headline}
      subtitle={formatIncidentType(
        alert.entity_type,
      )}
      onClose={onClose}
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  alert.is_active
                    ? "border-red-800 bg-red-950 text-red-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-300"
                }`}
              >
                {formatIncidentState(
                  alert.is_active
                    ? "active"
                    : "resolved",
                )}
              </span>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  alert.severity === "critical"
                    ? "border-red-800 bg-red-950 text-red-300"
                    : alert.severity === "warning"
                      ? "border-amber-800 bg-amber-950 text-amber-300"
                      : alert.severity === "info"
                        ? "border-sky-800 bg-sky-950 text-sky-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300"
                }`}
              >
                {alert.severity}
              </span>

              {alert.acknowledged_at ? (
                <span className="rounded-full border border-amber-800 bg-amber-950 px-2.5 py-1 text-xs text-amber-300">
                  Acknowledged
                </span>
              ) : null}
            </div>

            <p className="text-sm text-zinc-300">
              {subtext.targetLabel}
            </p>

            <p className="text-sm text-zinc-400">
              {alert.is_active
                ? "This alert is currently active and should be reviewed."
                : "This alert has resolved and remains available for timeline review."}
            </p>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Alert">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity type
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatIncidentType(
                  alert.entity_type,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Severity
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {alert.severity}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Created
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDate(alert.created_at)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Resolved
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDate(alert.resolved_at)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity key
              </div>
              <div className="mt-1 break-all text-sm text-zinc-100">
                {alert.entity_key}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Acknowledged
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDate(
                  alert.acknowledged_at,
                )}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <div className="flex flex-wrap gap-3">
          {isActiveUnacknowledged ? (
            <button
              type="button"
              disabled={acknowledgePending}
              onClick={() =>
                onAcknowledge(alert.id)
              }
              className="rounded-lg border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-300 hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {acknowledgePending
                ? "Acknowledging..."
                : "Acknowledge"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              copyText(alert.entity_key)
            }
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Copy target
          </button>

          <button
            type="button"
            onClick={() =>
              copyText(alert.message)
            }
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Copy message
          </button>
        </div>

        {acknowledgeErrorMessage ? (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {acknowledgeErrorMessage}
          </div>
        ) : null}

        <DrawerDetailSection label="Message summary">
          <div className="text-sm text-zinc-200">
            {headline}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Technical message">
          <div className="whitespace-pre-wrap break-words text-sm text-zinc-200">
            {alert.message}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Timeline">
          <div className="mt-1 space-y-3">
            {historyLoading ? (
              <p className="text-sm text-zinc-400">
                Loading timeline...
              </p>
            ) : historyError ? (
              <p className="text-sm text-red-400">
                Could not load timeline.
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No timeline events yet.
              </p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">
                        {formatAlertEventType(
                          item.event_type,
                        )}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {formatDate(
                          item.created_at,
                        )}
                      </p>
                    </div>

                    {formatAlertEventSummary(
                      item,
                    ) ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-400">
                        {formatAlertEventSummary(
                          item,
                        )}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerDetailSection>
      </div>
    </SideDrawer>
  );
}
