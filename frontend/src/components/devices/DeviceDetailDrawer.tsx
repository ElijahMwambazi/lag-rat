import { useQuery } from "@tanstack/react-query";
import DeviceFlags from "./DeviceFlags";
import DeviceMetaItem from "./DeviceMetaItem";
import { api } from "../../services/api";
import type { Device } from "../../services/api";

type Props = {
  device: Device | null;
  open: boolean;
  onClose: () => void;
  onEdit: (device: Device) => void;
};

export default function DeviceDetailDrawer({
  device,
  open,
  onClose,
  onEdit,
}: Props) {
  async function copyText(value?: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures for now
    }
  }

  const historyQuery = useQuery({
    queryKey: [
      "device-history",
      device?.ip_address,
    ],
    queryFn: () =>
      api.getDeviceHistory(device!.ip_address),
    enabled: open && !!device?.ip_address,
  });

  if (!open || !device) {
    return null;
  }

  function formatEventType(eventType: string) {
    switch (eventType) {
      case "first_seen":
        return "First seen";
      case "seen_again":
        return "Seen again";
      case "mac_changed":
        return "MAC address changed";
      case "hostname_changed":
        return "Hostname changed";
      case "label_changed":
        return "Label changed";
      case "label_added":
        return "Label added";
      case "notes_changed":
        return "Notes changed";
      default:
        return eventType.replace(/_/g, " ");
    }
  }

  function formatEventValues(
    eventType: string,
    previousValue?: string | null,
    newValue?: string | null,
  ) {
    if (!previousValue && !newValue) {
      return null;
    }

    if (
      eventType === "first_seen" ||
      eventType === "label_added"
    ) {
      return newValue ?? null;
    }

    if (
      eventType === "notes_changed" &&
      !previousValue &&
      newValue
    ) {
      return `Added: ${newValue}`;
    }

    if (
      eventType === "notes_changed" &&
      previousValue &&
      !newValue
    ) {
      return `Cleared: ${previousValue}`;
    }

    if (!previousValue && newValue) {
      return `Set to ${newValue}`;
    }

    if (previousValue && !newValue) {
      return `Removed: ${previousValue}`;
    }

    return `${previousValue} → ${newValue}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-zinc-100">
              {device.display_name}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Device details
            </p>
          </div>

          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-200">
              Flags
            </div>
            <DeviceFlags device={device} />
          </div>

          {device.notes ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Notes
              </div>
              <div className="mt-2 text-sm text-zinc-200">
                {device.notes}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DeviceMetaItem
              label="IP address"
              value={device.ip_address}
            />
            <DeviceMetaItem
              label="MAC address"
              value={device.mac_address ?? "—"}
            />
            <DeviceMetaItem
              label="Hostname"
              value={device.hostname ?? "—"}
            />
            <DeviceMetaItem
              label="Label"
              value={device.label ?? "—"}
            />
            <DeviceMetaItem
              label="First seen"
              value={
                device.first_seen
                  ? new Date(
                      device.first_seen,
                    ).toLocaleString()
                  : "—"
              }
            />
            <DeviceMetaItem
              label="Last seen"
              value={
                device.last_seen
                  ? new Date(
                      device.last_seen,
                    ).toLocaleString()
                  : "—"
              }
            />
            <DeviceMetaItem
              label="Confidence"
              value={device.confidence}
            />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-200">
              Recent activity
            </div>

            {historyQuery.isLoading ? (
              <div className="text-sm text-zinc-400">
                Loading history...
              </div>
            ) : historyQuery.isError ? (
              <div className="text-sm text-red-400">
                Could not load history.
              </div>
            ) : historyQuery.data?.length ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {historyQuery.data.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                  >
                    <div className="text-sm text-zinc-100">
                      {formatEventType(
                        item.event_type,
                      )}
                    </div>

                    {formatEventValues(
                      item.event_type,
                      item.previous_value,
                      item.new_value,
                    ) ? (
                      <div className="mt-1 text-xs text-zinc-400">
                        {formatEventValues(
                          item.event_type,
                          item.previous_value,
                          item.new_value,
                        )}
                      </div>
                    ) : null}

                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(
                        item.created_at,
                      ).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">
                No history yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
              onClick={() => onEdit(device)}
            >
              {device.is_known
                ? "Edit label"
                : "Add label"}
            </button>

            <button
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() =>
                copyText(device.ip_address)
              }
            >
              Copy IP
            </button>

            <button
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() =>
                copyText(device.mac_address)
              }
              disabled={!device.mac_address}
            >
              Copy MAC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
