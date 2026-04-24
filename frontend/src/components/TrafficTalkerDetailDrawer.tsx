import type { TrafficTopTalkerItem } from "../services/api";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";

type Props = {
  talker: TrafficTopTalkerItem | null;
  windowMinutes: number;
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

function formatWindowLabel(minutes: number) {
  if (minutes === 15) return "Last 15m";
  if (minutes === 60) return "Last 1h";
  if (minutes === 360) return "Last 6h";
  if (minutes === 1440) return "Last 24h";
  return `${minutes}m`;
}

function getTalkerTone(talker: TrafficTopTalkerItem) {
  if (talker.delta_bytes_total >= 100 * 1024 * 1024) {
    return "critical";
  }

  if (talker.delta_bytes_total >= 10 * 1024 * 1024) {
    return "warning";
  }

  if (talker.delta_bytes_total === 0) {
    return "stale";
  }

  return "healthy";
}

function getTalkerStatusLabel(talker: TrafficTopTalkerItem) {
  switch (getTalkerTone(talker)) {
    case "critical":
      return "Heavy mover";
    case "warning":
      return "Active mover";
    case "stale":
      return "No movement";
    case "healthy":
    default:
      return "Moderate movement";
  }
}

function getTalkerBadgeClasses(tone: string) {
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

function getTalkerNarrative(
  talker: TrafficTopTalkerItem,
  windowMinutes: number,
) {
  const moved = formatBytes(talker.delta_bytes_total);
  const windowLabel = formatWindowLabel(windowMinutes).toLowerCase();

  switch (getTalkerTone(talker)) {
    case "critical":
      return `${talker.interface_name} shows heavy traffic movement (${moved}) over the ${windowLabel} window.`;
    case "warning":
      return `${talker.interface_name} shows notable traffic movement (${moved}) over the ${windowLabel} window.`;
    case "stale":
      return `${talker.interface_name} shows no traffic movement across the selected window.`;
    case "healthy":
    default:
      return `${talker.interface_name} shows moderate traffic movement (${moved}) over the ${windowLabel} window.`;
  }
}

export default function TrafficTalkerDetailDrawer({
  talker,
  windowMinutes,
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

  if (!open || !talker) {
    return null;
  }

  const tone = getTalkerTone(talker);

  return (
    <SideDrawer
      open={open}
      title={`Top talker · ${talker.interface_name}`}
      subtitle={`${formatWindowLabel(windowMinutes)} · ${formatDate(
        talker.latest_sampled_at,
      )}`}
      onClose={onClose}
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${getTalkerBadgeClasses(
                  tone,
                )}`}
              >
                {getTalkerStatusLabel(talker)}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {talker.interface_name}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {formatWindowLabel(windowMinutes)}
              </span>
            </div>

            <p className="text-sm text-zinc-400">
              {getTalkerNarrative(talker, windowMinutes)}
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
                {talker.interface_name}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity type
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {talker.entity_type}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Entity key
              </div>
              <div className="mt-1 break-all text-sm text-zinc-100">
                {talker.entity_key}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText(talker.interface_name)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy interface
          </button>

          <button
            type="button"
            onClick={() => copyText(talker.entity_key)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy entity key
          </button>
        </div>

        <DrawerDetailSection label="Movement summary">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Total moved
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.delta_bytes_total)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Received
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.delta_bytes_rx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Sent
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.delta_bytes_tx)}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Counters">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Earliest RX
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.earliest_bytes_rx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Latest RX
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.latest_bytes_rx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Earliest TX
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.earliest_bytes_tx)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Latest TX
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatBytes(talker.latest_bytes_tx)}
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
                {talker.device_ip_address ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                MAC address
              </div>
              <div className="mt-1 break-all font-mono text-sm text-zinc-100">
                {talker.mac_address ?? "—"}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Last seen">
          <div className="space-y-2">
            <div className="text-sm text-zinc-100">
              {formatDate(talker.latest_sampled_at)}
            </div>
            <div className="text-sm text-zinc-400">
              {formatSampleAge(talker.latest_sampled_at)}
            </div>
          </div>
        </DrawerDetailSection>
      </div>
    </SideDrawer>
  );
}
