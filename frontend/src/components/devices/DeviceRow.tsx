import type { Device } from "../../services/api";
import DeviceFlags from "./DeviceFlags";

type Props = {
  device: Device;
  editingId: number | null;
  isSaving: boolean;
  label: string;
  notes: string;
  onStartEdit: (device: Device) => void;
  onCancelEdit: () => void;
  onSave: (device: Device) => void;
  onLabelChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onOpenDetails: (device: Device) => void;
};

function buildSecondaryIdentity(device: Device) {
  if (
    device.hostname &&
    device.hostname !== device.display_name
  ) {
    return device.hostname;
  }

  if (
    device.label &&
    device.label !== device.display_name
  ) {
    return device.label;
  }

  return null;
}

export default function DeviceRow({
  device,
  editingId,
  isSaving,
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

  const secondaryIdentity =
    buildSecondaryIdentity(device);

  return (
    <tr
      className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-zinc-800/60"
      onClick={() => onOpenDetails(device)}
    >
      <td className="w-[32%] px-4 py-3 align-top">
        {isEditing ? (
          <div className="space-y-2">
            <input
              value={label}
              disabled={isSaving}
              onChange={(e) =>
                onLabelChange(e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Device label"
            />

            <input
              value={notes}
              disabled={isSaving}
              onChange={(e) =>
                onNotesChange(e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Notes"
            />

            <div className="flex gap-2">
              <button
                disabled={isSaving}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(device);
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>

              <button
                disabled={isSaving}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="space-y-2">
              <div className="min-w-0">
                <div className="font-medium text-zinc-100">
                  {device.display_name}
                </div>

                {secondaryIdentity ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    {secondaryIdentity}
                  </div>
                ) : null}
              </div>

              {device.notes ? (
                <div className="line-clamp-2 text-xs leading-5 text-zinc-400">
                  {device.notes}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
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
            </div>
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
