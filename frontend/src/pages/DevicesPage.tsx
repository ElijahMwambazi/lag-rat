import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

function isRecent(lastSeen?: string | null) {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff <= 24 * 60 * 60 * 1000;
}

export default function DevicesPage() {
  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: api.getDevices,
    refetchInterval: 60000,
  });

  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Devices</h2>
        <p className="text-sm text-zinc-400">{devices.length} devices</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left">IP</th>
              <th className="px-4 py-3 text-left">MAC</th>
              <th className="px-4 py-3 text-left">Host</th>
              <th className="px-4 py-3 text-left">First seen</th>
              <th className="px-4 py-3 text-left">Last seen</th>
              <th className="px-4 py-3 text-left">Recent</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-zinc-400">No devices observed yet.</td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">{device.ip_address}</td>
                  <td className="px-4 py-3">{device.mac_address ?? "—"}</td>
                  <td className="px-4 py-3">{device.hostname ?? "—"}</td>
                  <td className="px-4 py-3">{device.first_seen ? new Date(device.first_seen).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">{device.last_seen ? new Date(device.last_seen).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">{isRecent(device.last_seen) ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
