import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export default function DevicesPage() {
  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: api.getDevices, refetchInterval: 60000 });
  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Devices</h2><p className="text-sm text-zinc-400">{devices.length} devices</p></div>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/50 text-zinc-300">
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">IP</th><th className="px-4 py-3 text-left">MAC</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Last seen</th><th className="px-4 py-3 text-left">Flags</th></tr>
          </thead>
          <tbody>
            {devices.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-zinc-400">No devices observed yet.</td></tr> : devices.map((device) => (
              <tr key={device.id} className="border-t border-zinc-800">
                <td className="px-4 py-3"><div className="font-medium">{device.display_name}</div>{device.notes ? <div className="text-xs text-zinc-400">{device.notes}</div> : null}</td>
                <td className="px-4 py-3">{device.ip_address}</td>
                <td className="px-4 py-3">{device.mac_address ?? "—"}</td>
                <td className="px-4 py-3">{device.hostname ?? "—"}</td>
                <td className="px-4 py-3">{device.last_seen ? new Date(device.last_seen).toLocaleString() : "—"}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-2">{device.is_gateway ? <span className="rounded-full border border-sky-800 bg-sky-950 px-2 py-0.5 text-xs text-sky-300">Gateway</span> : null}{device.is_known ? <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Known</span> : null}{device.is_recent ? <span className="rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-xs text-amber-300">Recent</span> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
