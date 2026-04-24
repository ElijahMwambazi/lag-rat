import type { WifiSample } from "../services/api";
import { useNavigate } from "react-router-dom";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";

type Props = {
  sample: WifiSample | null;
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

function formatRssi(value?: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value} dBm`;
}

function getWifiSampleDisplayTitle(sample: WifiSample | null) {
  if (!sample) return "Wi-Fi sample";

  return sample.location_label
    ? `Wi-Fi sample · ${sample.location_label}`
    : "Wi-Fi sample";
}

function getWifiSampleStatusTone(sample: WifiSample) {
  if (sample.rssi_dbm === null || sample.rssi_dbm === undefined) {
    return "stale";
  }

  if (sample.rssi_dbm <= -75) {
    return "critical";
  }

  if (sample.rssi_dbm <= -67) {
    return "warning";
  }

  return "healthy";
}

function getWifiSampleStatusLabel(sample: WifiSample) {
  const tone = getWifiSampleStatusTone(sample);

  switch (tone) {
    case "critical":
      return "Poor";
    case "warning":
      return "Weak";
    case "stale":
      return "Unknown";
    case "healthy":
    default:
      return "Healthy";
  }
}

function getWifiSampleStatusBadgeClasses(tone: string) {
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

function getWifiSampleNarrative(sample: WifiSample) {
  const tone = getWifiSampleStatusTone(sample);

  switch (tone) {
    case "critical":
      return "Signal quality is poor for this sample and likely to impact stability or throughput.";
    case "warning":
      return "Signal quality is weaker than ideal for this sample and may need attention.";
    case "stale":
      return "Signal quality could not be interpreted from this sample.";
    case "healthy":
    default:
      return "Signal quality looks healthy for this sample.";
  }
}

export default function WifiSampleDetailDrawer({
  sample,
  open,
  onClose,
}: Props) {
  const navigate = useNavigate();

  async function copyText(value?: string | null) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures for now
    }
  }

  if (!open || !sample) {
    return null;
  }

  const currentSample = sample;

  function openDeviceDetails() {
    if (!currentSample.bssid) {
      return;
    }

    const params = new URLSearchParams();
    params.set("deviceMac", currentSample.bssid);

    onClose();
    navigate(`/devices?${params.toString()}`);
  }

  return (
    <SideDrawer
      open={open}
      title={getWifiSampleDisplayTitle(sample)}
      subtitle={`${formatDate(
        sample.sampled_at,
      )} · ${formatSampleAge(sample.sampled_at)}`}
      onClose={onClose}
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${getWifiSampleStatusBadgeClasses(
                  getWifiSampleStatusTone(sample),
                )}`}
              >
                {getWifiSampleStatusLabel(sample)}
              </span>

              {sample.band ? (
                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                  {sample.band}
                </span>
              ) : null}
            </div>

            <p className="text-sm text-zinc-400">
              {getWifiSampleNarrative(sample)}
            </p>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Location">
          <div className="text-sm text-zinc-100">
            {sample.location_label ?? "—"}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Sample">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Signal
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatRssi(sample.rssi_dbm)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                SSID
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.ssid ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Band
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.band ?? "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Frequency
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.frequency_mhz != null
                  ? `${sample.frequency_mhz} MHz`
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Interface
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {sample.interface_name ?? "—"}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText(sample.ssid)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy SSID
          </button>

          <button
            type="button"
            onClick={() => copyText(sample.bssid)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Copy BSSID
          </button>

          {sample.bssid ? (
            <button
              type="button"
              onClick={openDeviceDetails}
              className="rounded-lg border border-cyan-700 bg-cyan-950 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-900"
            >
              Open device details
            </button>
          ) : null}
        </div>

        <DrawerDetailSection label="Identifiers">
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                BSSID
              </div>
              <div className="mt-1 break-all font-mono text-sm text-zinc-100">
                {sample.bssid ?? "—"}
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
