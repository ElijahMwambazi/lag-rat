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

  const lowConfidenceCount = devices.filter(
    (device) => device.confidence === "low",
  ).length;

  const hiddenLowConfidenceCount =
    showLowConfidence ? 0 : lowConfidenceCount;

  const hasFiltersApplied =
    search.trim().length > 0 ||
    sortBy !== "last_seen" ||
    showLowConfidence;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Devices
          </h2>
          <p className="mt-2 text-zinc-400">
            Review devices seen on your local
            network, save labels, and inspect
            device history.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm text-zinc-400">
            {devicesQuery.isLoading
              ? "Loading..."
              : `${visibleDevices.length} shown · ${devices.length} total`}
          </p>

          {hiddenLowConfidenceCount > 0 ? (
            <p className="mt-1 text-xs text-zinc-500">
              {hiddenLowConfidenceCount}{" "}
              low-confidence{" "}
              {hiddenLowConfidenceCount === 1
                ? "device is"
                : "devices are"}{" "}
              hidden to reduce scan noise.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-100">
              Explorer
            </h3>
            <p className="text-sm text-zinc-400">
              Search by label, hostname, IP, MAC,
              or notes. Click a row to open device
              details.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={showLowConfidence}
              onChange={(e) =>
                setShowLowConfidence(
                  e.target.checked,
                )
              }
            />
            Include low-confidence devices
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search label, host, IP, MAC, or notes..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:col-span-2 lg:max-w-md"
          />

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as SortKey)
            }
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 sm:w-auto"
          >
            <option value="last_seen">
              Sort: Last seen
            </option>
            <option value="name">
              Sort: Name
            </option>
            <option value="confidence">
              Sort: Confidence
            </option>
          </select>
        </div>
      </section>

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
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">
                  Device
                </th>
                <th className="px-4 py-3 text-left">
                  IP
                </th>
                <th className="px-4 py-3 text-left">
                  MAC
                </th>
                <th className="px-4 py-3 text-left">
                  Hostname
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
                    {hasFiltersApplied
                      ? "No devices match the current search or filters."
                      : "No devices have been recorded yet."}
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
    </div>
  );
}
