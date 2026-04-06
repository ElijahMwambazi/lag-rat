import QueryState from "../components/QueryState";
import DeviceRow from "../components/devices/DeviceRow";
import DeviceDetailDrawer from "../components/devices/DeviceDetailDrawer";
import { api } from "../services/api";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

export default function DevicesPage() {
  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: api.getDevices,
    refetchInterval: 60000,
  });

  const devices = devicesQuery.data ?? [];

  const [
    showLowConfidence,
    setShowLowConfidence,
  ] = useState(false);

  const visibleDevices = devices.filter(
    (device) =>
      showLowConfidence ||
      device.confidence !== "low",
  );

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<
    number | null
  >(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedDevice, setSelectedDevice] =
    useState<(typeof devices)[number] | null>(
      null,
    );

  const saveKnownDeviceMutation = useMutation({
    mutationFn: api.saveKnownDevice,
    onSuccess: async () => {
      setEditingId(null);
      setLabel("");
      setNotes("");
      await queryClient.invalidateQueries({
        queryKey: ["devices"],
      });
    },
  });

  function startEdit(
    device: (typeof devices)[number],
  ) {
    setSelectedDevice(device);
    setEditingId(device.id);
    setLabel(
      device.label ?? device.display_name ?? "",
    );
    setNotes(device.notes ?? "");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            Devices
          </h2>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showLowConfidence}
              onChange={(e) =>
                setShowLowConfidence(
                  e.target.checked,
                )
              }
            />
            Show low-confidence
          </label>

          {!showLowConfidence &&
          devices.length !==
            visibleDevices.length ? (
            <p className="text-sm text-zinc-500">
              {devices.length -
                visibleDevices.length}{" "}
              low-confidence devices hidden
            </p>
          ) : null}

          <p className="text-sm text-zinc-400">
            {devicesQuery.isLoading
              ? "Loading..."
              : `${visibleDevices.length} shown · ${devices.length} total`}
          </p>
        </div>
      </div>

      {devicesQuery.isError ? (
        <QueryState
          title="Devices request failed"
          tone="error"
          message={
            devicesQuery.error instanceof Error
              ? devicesQuery.error.message
              : "The devices endpoint failed."
          }
        />
      ) : null}

      {saveKnownDeviceMutation.isError ? (
        <QueryState
          title="Save failed"
          tone="error"
          message={
            saveKnownDeviceMutation.error instanceof
            Error
              ? saveKnownDeviceMutation.error
                  .message
              : "Could not save known device."
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left">
                Name
              </th>
              <th className="px-4 py-3 text-left">
                IP
              </th>
              <th className="px-4 py-3 text-left">
                MAC
              </th>
              <th className="px-4 py-3 text-left">
                Host
              </th>
              <th className="px-4 py-3 text-left">
                Last seen
              </th>
              <th className="px-4 py-3 text-left">
                Flags
              </th>
            </tr>
          </thead>
          <tbody>
            {devicesQuery.isLoading &&
            devices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-zinc-400"
                >
                  Loading devices...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-zinc-400"
                >
                  No devices observed yet.
                </td>
              </tr>
            ) : (
              visibleDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  editingId={editingId}
                  label={label}
                  notes={notes}
                  onStartEdit={startEdit}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setLabel("");
                    setNotes("");
                  }}
                  onSave={(device) =>
                    saveKnownDeviceMutation.mutate(
                      {
                        ip_address:
                          device.ip_address,
                        mac_address:
                          device.mac_address,
                        label,
                        notes,
                      },
                    )
                  }
                  onLabelChange={setLabel}
                  onNotesChange={setNotes}
                  onOpenDetails={
                    setSelectedDevice
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeviceDetailDrawer
        device={selectedDevice}
        open={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
        onEdit={startEdit}
      />
    </div>
  );
}
