import type { TrafficSample } from "../services/api";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";

type Props = {
  sample: TrafficSample | null;
  open: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatSampleAge(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  const diffMs = Date.now() - parsed.getTime();

  if (Number.isNaN(parsed.getTime()) || diffMs < 0) {
    return "Unknown";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getTrafficSampleDisplayTitle(sample: TrafficSample | null) {
  if (!sample) return "Traffic sample";

  return sample.interface_name
    ? `Traffic sample · ${sample.interface_name}`
    : "Traffic sample";
}

function getTrafficSampleStatusTone(sample: TrafficSample) {
  const total = (sample.bytes_rx ?? 0) + (sample.bytes_tx ?? 0);

  if (total === 0) return "stale";
  if (total >= 100 * 1024 * 1024) return "critical";
  if (total >= 10 * 1024 * 1024) return "warning";
  return "healthy";
}

function getTrafficSampleStatusLabel(sample: TrafficSample) {
  switch (getTrafficSampleStatusTone(sample)) {
    case "critical":
      return "High activity";
    case "warning":
      return "Active";
    case "stale":
      return "Idle";
    case "healthy":
    default:
      return "Normal";
  }
}

function getTrafficSampleStatusBadgeClasses(tone: string) {
  switch (tone) {
    case "critical":
      return "border-red-800 bg-red-950 text-red-300";
    case "warning":
      return "border-amber-800 bg-amber-950 text-amber-300";
    case "stale":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
    case "healthy":
    default:
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
  }
}

function getTrafficSampleNarrative(sample: TrafficSample) {
  const total = (sample.bytes_rx ?? 0) + (sample.bytes_tx ?? 0);

  switch (getTrafficSampleStatusTone(sample)) {
    case "critical":
      return `This capture shows high traffic activity (${formatBytes(total)}) across received and sent counters.`;
    case "warning":
      return `This capture shows notable traffic activity (${formatBytes(total)}) for the selected scope.`;
    case "stale":
      return "This capture shows no byte movement across received and sent counters.";
    case "healthy":
    default:
      return `This capture shows moderate traffic activity (${formatBytes(total)}).`;
  }
}

export default function TrafficSampleDetailDrawer({
  sample,
  open,
  onClose,
}: Props) {
  async function copyText(value?: string | null) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures
    }
  }

  if (!open || !sample) {
    return null;
  }

  const totalTraffic = (sample.bytes_rx ?? 0) + (sample.bytes_tx ?? 0);

  return (
    <SideDrawer
      open={open}
      title={getTrafficSampleDisplayTitle(sample)}
      subtitle={`${formatDate(sample.sampled_at)} · ${formatSampleAge(
        sample.sampled_at,
      )}`}
      onClose={onClose}
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${getTrafficSampleStatusBadgeClasses(
                  getTrafficSampleStatusTone(sample),
                )}`}
              >
                {getTrafficSampleStatusLabel(sample)}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {sample.interface_name ?? "Unknown interface"}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {sample.entity_type ?? "Unknown scope"}
              </span>
            </div>

            <p className="text-sm text-zinc-400">
              {getTrafficSampleNarrative(sample)}
            </p>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Scope">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Interface
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.interface_name ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity type
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.entity_type ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity key
              </div>
              <div className="mt-1 break-all text-sm text-zinc-100">
                {sample.entity_key ?? "—"}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText(sample.interface_name)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy interface
          </button>

          <button
            type="button"
            onClick={() => copyText(sample.entity_key)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy entity key
          </button>
        </div>

        <DrawerDetailSection label="Sample">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Total traffic
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(totalTraffic)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Received
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(sample.bytes_rx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Sent
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(sample.bytes_tx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                RX packets
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.packets_rx ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                TX packets
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.packets_tx ?? "—"}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Identifiers">
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Device IP
              </div>
              <div className="mt-1 break-all font-mono text-sm text-zinc-100">
                {sample.device_ip_address ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                MAC address
              </div>
              <div className="mt-1 break-all font-mono text-sm text-zinc-100">
                {sample.mac_address ?? "—"}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Captured at">
          <div className="space-y-2">
            <div className="text-sm text-zinc-100">
              {formatDate(sample.sampled_at)}
            </div>
            <div className="text-sm text-zinc-400">
              {formatSampleAge(sample.sampled_at)}
            </div>
          </div>
        </DrawerDetailSection>
      </div>
    </SideDrawer>
  );
}
