import type {
  Alert,
  AlertHistoryItem,
} from "../services/api";
import SideDrawer from "./SideDrawer";
import DrawerDetailSection from "./DrawerDetailSection";

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
  if (!open || !alert) {
    return null;
  }

  return (
    <SideDrawer
      open={open}
      title="Alert details"
      subtitle={alert.alert_type}
      onClose={onClose}
    >
      <DrawerDetailSection label="Message">
        <div className="whitespace-pre-wrap break-words">
          {alert.message}
        </div>
      </DrawerDetailSection>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DrawerDetailSection label="Entity type">
          {alert.entity_type}
        </DrawerDetailSection>

        <DrawerDetailSection label="Entity key">
          <div className="break-all">
            {alert.entity_key}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Severity">
          {alert.severity}
        </DrawerDetailSection>

        <DrawerDetailSection label="Status">
          {alert.is_active
            ? "Active"
            : "Resolved"}
        </DrawerDetailSection>

        <DrawerDetailSection label="Created">
          {formatDate(alert.created_at)}
        </DrawerDetailSection>

        <DrawerDetailSection label="Resolved">
          {formatDate(alert.resolved_at)}
        </DrawerDetailSection>

        <DrawerDetailSection label="Acknowledged">
          {formatDate(alert.acknowledged_at)}
        </DrawerDetailSection>
      </div>

      {alert.is_active &&
      !alert.acknowledged_at ? (
        <button
          type="button"
          disabled={acknowledgePending}
          onClick={() => onAcknowledge(alert.id)}
          className="rounded-lg border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-300 hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {acknowledgePending
            ? "Acknowledging..."
            : "Acknowledge"}
        </button>
      ) : null}

      {acknowledgeErrorMessage ? (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {acknowledgeErrorMessage}
        </div>
      ) : null}

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
            history.map((item) => (
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
                    {formatDate(item.created_at)}
                  </p>
                </div>

                {formatAlertEventSummary(item) ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-400">
                    {formatAlertEventSummary(
                      item,
                    )}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </DrawerDetailSection>
    </SideDrawer>
  );
}
