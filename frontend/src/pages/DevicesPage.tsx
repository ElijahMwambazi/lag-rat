import QueryState from "../components/QueryState";
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

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<
    number | null
  >(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

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
    setEditingId(device.id);
    setLabel(
      device.label ?? device.display_name ?? "",
    );
    setNotes(device.notes ?? "");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">
          Devices
        </h2>
        <p className="text-sm text-zinc-400">
          {devicesQuery.isLoading
            ? "Loading..."
            : `${devices.length} devices`}
        </p>
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
              devices.map((device) => (
                <tr
                  key={device.id}
                  className="border-t border-zinc-800"
                >
                  <td className="px-4 py-3">
                    {editingId === device.id ? (
                      <div className="space-y-2">
                        <input
                          value={label}
                          onChange={(e) =>
                            setLabel(
                              e.target.value,
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                          placeholder="Device label"
                        />
                        <input
                          value={notes}
                          onChange={(e) =>
                            setNotes(
                              e.target.value,
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                          placeholder="Notes"
                        />
                        <div className="flex gap-2">
                          <button
                            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900"
                            onClick={() =>
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
                          >
                            Save
                          </button>
                          <button
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs"
                            onClick={() => {
                              setEditingId(null);
                              setLabel("");
                              setNotes("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">
                          {device.display_name}
                        </div>
                        {device.notes ? (
                          <div className="text-xs text-zinc-400">
                            {device.notes}
                          </div>
                        ) : null}
                        <button
                          className="mt-2 text-xs text-zinc-400 underline underline-offset-2"
                          onClick={() =>
                            startEdit(device)
                          }
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
                    <div className="flex flex-wrap gap-2">
                      {device.is_gateway ? (
                        <span className="rounded-full border border-sky-800 bg-sky-950 px-2 py-0.5 text-xs text-sky-300">
                          Gateway
                        </span>
                      ) : null}
                      {device.is_known ? (
                        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
                          Known
                        </span>
                      ) : null}
                      {device.is_recent ? (
                        <span className="rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
                          Recent
                        </span>
                      ) : null}
                    </div>
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
