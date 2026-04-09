import QueryState from "../components/QueryState";
import DeviceRow from "../components/devices/DeviceRow";
import DeviceDetailDrawer from "../components/devices/DeviceDetailDrawer";
import {
  api,
  type KnownDevice,
} from "../services/api";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

type SortKey =
  | "last_seen"
  | "name"
  | "confidence";

function confidenceRank(
  value: "high" | "medium" | "low",
) {
  if (value === "high") return 0;
  if (value === "medium") return 1;
  return 2;
}

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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] =
    useState<SortKey>("last_seen");

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

  const saveKnownDeviceMutation = useMutation<
    KnownDevice,
    Error,
    Parameters<typeof api.saveKnownDevice>[0]
  >({
    mutationFn: api.saveKnownDevice,
    onSuccess: async (savedDevice) => {
      const nextSelectedDevice =
        selectedDevice &&
        (savedDevice.ip_address ===
          selectedDevice.ip_address ||
          (savedDevice.mac_address &&
            savedDevice.mac_address ===
              selectedDevice.mac_address))
          ? {
              ...selectedDevice,
              label: savedDevice.label,
              notes: savedDevice.notes,
              is_known: true,
              display_name:
                savedDevice.label ??
                selectedDevice.display_name,
            }
          : selectedDevice;

      setSelectedDevice(nextSelectedDevice);
      setEditingId(null);
      setLabel("");
      setNotes("");

      await queryClient.invalidateQueries({
        queryKey: ["devices"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["status-overview"],
      });

      if (savedDevice.ip_address) {
        await queryClient.invalidateQueries({
          queryKey: [
            "device-history",
            savedDevice.ip_address,
          ],
        });
      }
    },
  });

  function startEdit(
    device: (typeof devices)[number],
  ) {
    setSelectedDevice(null);
    setEditingId(device.id);
    setLabel(
      device.label ?? device.display_name ?? "",
    );
    setNotes(device.notes ?? "");
  }

  const visibleDevices = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = devices.filter((device) => {
      if (
        !showLowConfidence &&
        device.confidence === "low"
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [
        device.display_name,
        device.label,
        device.hostname,
        device.ip_address,
        device.mac_address,
        device.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.display_name.localeCompare(
          b.display_name,
        );
      }

      if (sortBy === "confidence") {
        return (
          confidenceRank(a.confidence) -
            confidenceRank(b.confidence) ||
          a.display_name.localeCompare(
            b.display_name,
          )
        );
      }

      const aTime = a.last_seen
        ? new Date(a.last_seen).getTime()
        : 0;
      const bTime = b.last_seen
        ? new Date(b.last_seen).getTime()
        : 0;

      return bTime - aTime;
    });

    return sorted;
  }, [
    devices,
    search,
    showLowConfidence,
    sortBy,
  ]);

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
            devices.filter(
              (d) => d.confidence !== "low",
            ).length ? (
            <p className="text-sm text-zinc-500">
              {
                devices.filter(
                  (d) => d.confidence === "low",
                ).length
              }{" "}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search label, host, IP, MAC..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:max-w-md"
        />

        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as SortKey)
          }
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100"
        >
          <option value="last_seen">
            Sort: Last seen
          </option>
          <option value="name">Sort: Name</option>
          <option value="confidence">
            Sort: Confidence
          </option>
        </select>
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
            ) : visibleDevices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-zinc-400"
                >
                  No matching devices.
                </td>
              </tr>
            ) : (
              visibleDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  editingId={editingId}
                  isSaving={
                    saveKnownDeviceMutation.isPending &&
                    editingId === device.id
                  }
                  label={label}
                  notes={notes}
                  onStartEdit={startEdit}
                  onCancelEdit={() => {
                    if (
                      saveKnownDeviceMutation.isPending
                    ) {
                      return;
                    }

                    setEditingId(null);
                    setLabel("");
                    setNotes("");
                  }}
                  onSave={(device) => {
                    if (
                      saveKnownDeviceMutation.isPending
                    ) {
                      return;
                    }

                    saveKnownDeviceMutation.mutate(
                      {
                        ip_address:
                          device.ip_address,
                        mac_address:
                          device.mac_address,
                        label,
                        notes,
                      },
                    );
                  }}
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
