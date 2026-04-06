import type { Device } from "../../services/api";
import DeviceFlags from "./DeviceFlags";

type Props = {
  device: Device;
  editingId: number | null;
  label: string;
  notes: string;
  onStartEdit: (device: Device) => void;
  onCancelEdit: () => void;
  onSave: (device: Device) => void;
  onLabelChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onOpenDetails: (device: Device) => void;
};

export default function DeviceRow({
  device,
  editingId,
  label,
  notes,
  onStartEdit,
  onCancelEdit,
  onSave,
  onLabelChange,
  onNotesChange,
  onOpenDetails,
}: Props) {
  const isEditing = editingId === device.id;

  return (
    <tr
      className="border-t border-zinc-800"
      onClick={() => onOpenDetails(device)}
    >
      <td className="w-[28%] px-4 py-3 align-top">
        {isEditing ? (
          <div className="space-y-2">
            <input
              value={label}
              onChange={(e) =>
                onLabelChange(e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Device label"
            />

            <input
              value={notes}
              onChange={(e) =>
                onNotesChange(e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Notes"
            />
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(device);
                }}
              >
                Save
              </button>

              <button
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <button
              className="block w-full text-left font-medium text-zinc-100 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(device);
              }}
            >
              {device.display_name}
            </button>

            {device.notes ? (
              <div className="text-xs text-zinc-400">
                {device.notes}
              </div>
            ) : null}

            <button
              className="block text-left text-xs text-zinc-400 underline underline-offset-2"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(device);
              }}
            >
              {device.is_known
                ? "Edit label"
                : "Add label"}
            </button>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        {device.ip_address}
      </td>
      <td className="px-4 py-3">
        {device.mac_address ?? "—"}
      </td>
      <td className="px-4 py-3">
        {device.hostname ?? "—"}
      </td>
      <td className="px-4 py-3">
        {device.last_seen
          ? new Date(
              device.last_seen,
            ).toLocaleString()
          : "—"}
      </td>
      <td className="px-4 py-3">
        <DeviceFlags device={device} />
      </td>
    </tr>
  );
}
