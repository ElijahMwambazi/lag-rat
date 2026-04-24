import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QueryState from "../components/QueryState";
import DeviceRow from "../components/devices/DeviceRow";
import DeviceDetailDrawer from "../components/devices/DeviceDetailDrawer";
import { api, type KnownDevice } from "../services/api";

type SortKey = "last_seen" | "name" | "confidence";

const SHOW_LOW_CONFIDENCE_STORAGE_KEY = "lag-rat:devices:show-low-confidence";
const DEVICE_IP_PARAM = "deviceIp";
const DEVICE_MAC_PARAM = "deviceMac";

function confidenceRank(value: "high" | "medium" | "low") {
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

  const [searchParams, setSearchParams] = useSearchParams();

  const devices = devicesQuery.data ?? [];

  const [showLowConfidence, setShowLowConfidence] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return (
        window.localStorage.getItem(SHOW_LOW_CONFIDENCE_STORAGE_KEY) === "true"
      );
    } catch {
      return false;
    }
  });

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("last_seen");

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedDevice, setSelectedDevice] = useState<
    (typeof devices)[number] | null
  >(null);

  const selectedDeviceIp = searchParams.get(DEVICE_IP_PARAM);
  const selectedDeviceMac = searchParams.get(DEVICE_MAC_PARAM);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SHOW_LOW_CONFIDENCE_STORAGE_KEY,
        String(showLowConfidence),
      );
    } catch {
      // ignore storage failures
    }
  }, [showLowConfidence]);

  useEffect(() => {
    if (!selectedDeviceIp && !selectedDeviceMac) {
      return;
    }

    const matchedDevice =
      devices.find(
        (device) =>
          (selectedDeviceIp && device.ip_address === selectedDeviceIp) ||
          (selectedDeviceMac && device.mac_address === selectedDeviceMac),
      ) ?? null;

    if (matchedDevice) {
      setSelectedDevice((current) =>
        current?.id === matchedDevice.id ? current : matchedDevice,
      );
    }
  }, [devices, selectedDeviceIp, selectedDeviceMac]);

  useEffect(() => {
    if (!selectedDeviceIp && !selectedDeviceMac) {
      setSelectedDevice(null);
    }
  }, [selectedDeviceIp, selectedDeviceMac]);

  function openDeviceDetails(device: (typeof devices)[number]) {
    const next = new URLSearchParams(searchParams);

    next.set(DEVICE_IP_PARAM, device.ip_address);

    if (device.mac_address) {
      next.set(DEVICE_MAC_PARAM, device.mac_address);
    } else {
      next.delete(DEVICE_MAC_PARAM);
    }

    setSelectedDevice(device);
    setSearchParams(next);
  }

  function closeDeviceDetails() {
    const next = new URLSearchParams(searchParams);

    next.delete(DEVICE_IP_PARAM);
    next.delete(DEVICE_MAC_PARAM);

    setSelectedDevice(null);
    setSearchParams(next);
  }

  const saveKnownDeviceMutation = useMutation<
    KnownDevice,
    Error,
    Parameters<typeof api.saveKnownDevice>[0]
  >({
    mutationFn: api.saveKnownDevice,
    onSuccess: async (savedDevice) => {
      const nextSelectedDevice =
        selectedDevice &&
        (savedDevice.ip_address === selectedDevice.ip_address ||
          (savedDevice.mac_address &&
            savedDevice.mac_address === selectedDevice.mac_address))
          ? {
              ...selectedDevice,
              label: savedDevice.label,
              notes: savedDevice.notes,
              is_known: true,
              display_name: savedDevice.label ?? selectedDevice.display_name,
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
          queryKey: ["device-history", savedDevice.ip_address],
        });
      }
    },
  });

  function startEdit(device: (typeof devices)[number]) {
    closeDeviceDetails();
    setEditingId(device.id);
    setLabel(device.label ?? device.display_name ?? "");
    setNotes(device.notes ?? "");
  }

  const visibleDevices = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = devices.filter((device) => {
      if (!showLowConfidence && device.confidence === "low") {
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
        return a.display_name.localeCompare(b.display_name);
      }

      if (sortBy === "confidence") {
        return (
          confidenceRank(a.confidence) - confidenceRank(b.confidence) ||
          a.display_name.localeCompare(b.display_name)
        );
      }

      const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;

      return bTime - aTime;
    });

    return sorted;
  }, [devices, search, showLowConfidence, sortBy]);

  const lowConfidenceCount = devices.filter(
    (device) => device.confidence === "low",
  ).length;

  const hiddenLowConfidenceCount = showLowConfidence ? 0 : lowConfidenceCount;

  const hasFiltersApplied =
    search.trim().length > 0 || sortBy !== "last_seen" || showLowConfidence;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Devices</h2>
          <p className="mt-2 text-zinc-400">
            Review devices seen on your local network, save labels, and inspect
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
              {hiddenLowConfidenceCount} low-confidence{" "}
              {hiddenLowConfidenceCount === 1 ? "device is" : "devices are"}{" "}
              hidden to reduce scan noise.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-100">Explorer</h3>
            <p className="text-sm leading-6 text-zinc-400">
              Search by label, hostname, IP, MAC, or notes. Open a row for full
              device details and history.
            </p>
          </div>

          <label className="flex w-full items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300 lg:w-auto lg:items-center">
            <input
              type="checkbox"
              checked={showLowConfidence}
              onChange={(e) => setShowLowConfidence(e.target.checked)}
              className="mt-0.5 lg:mt-0"
            />
            <span>Include low-confidence devices</span>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search label, host, IP, MAC, or notes..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 sm:col-span-2 lg:col-span-1"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100"
          >
            <option value="last_seen">Sort: Last seen</option>
            <option value="name">Sort: Name</option>
            <option value="confidence">Sort: Confidence</option>
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
            saveKnownDeviceMutation.error instanceof Error
              ? saveKnownDeviceMutation.error.message
              : "Could not save known device."
          }
        />
      ) : null}

      <div className="rounded-t-2xl border border-zinc-800 border-b-0 bg-zinc-950/40 px-4 py-3 text-sm leading-6 text-zinc-400">
        Swipe horizontally to view all device columns. Tap a row to open full
        device details.
      </div>

      <div className="overflow-hidden rounded-b-2xl border border-zinc-800 bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-zinc-800/50 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Device</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-left">MAC</th>
                <th className="px-4 py-3 text-left">Hostname</th>
                <th className="px-4 py-3 text-left">Last seen</th>
                <th className="px-4 py-3 text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {devicesQuery.isLoading && devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-zinc-400">
                    Loading devices...
                  </td>
                </tr>
              ) : visibleDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-zinc-400">
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
                      if (saveKnownDeviceMutation.isPending) {
                        return;
                      }

                      setEditingId(null);
                      setLabel("");
                      setNotes("");
                    }}
                    onSave={(device) => {
                      if (saveKnownDeviceMutation.isPending) {
                        return;
                      }

                      saveKnownDeviceMutation.mutate({
                        ip_address: device.ip_address,
                        mac_address: device.mac_address,
                        label,
                        notes,
                      });
                    }}
                    onLabelChange={setLabel}
                    onNotesChange={setNotes}
                    onOpenDetails={openDeviceDetails}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <DeviceDetailDrawer
          device={selectedDevice}
          open={selectedDevice !== null}
          onClose={closeDeviceDetails}
          onEdit={startEdit}
        />
      </div>
    </div>
  );
}
