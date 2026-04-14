import type { Outage } from "../services/api";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";
import {
  formatIncidentState,
  formatIncidentType,
  summarizeOutageCause,
} from "../utils/incidentText";

type Props = {
  outage: Outage | null;
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

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) {
    return "—";
  }
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function OutageDetailDrawer({
  outage,
  open,
  onClose,
}: Props) {
  async function copyText(value?: string | null) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures for now
    }
  }

  if (!open || !outage) {
    return null;
  }

  const summarizedCause = summarizeOutageCause(
    outage.start_error,
  );

  return (
    <SideDrawer
      open={open}
      title={formatIncidentType(
        outage.outage_type,
      )}
      subtitle="Incident details"
      onClose={onClose}
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  outage.status === "active"
                    ? "border-red-800 bg-red-950 text-red-300"
                    : "border-emerald-800 bg-emerald-950 text-emerald-300"
                }`}
              >
                {formatIncidentState(
                  outage.status,
                )}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {formatDuration(
                  outage.duration_seconds,
                )}
              </span>
            </div>

            <p className="text-sm text-zinc-400">
              {outage.status === "active"
                ? "This incident is still active and may require immediate attention."
                : "This incident has recovered and remains available for review."}
            </p>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Target">
          <div className="break-all text-sm text-zinc-100">
            {outage.target}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Incident">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Type
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatIncidentType(
                  outage.outage_type,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Duration
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDuration(
                  outage.duration_seconds,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Started
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDate(outage.started_at)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Ended
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDate(outage.ended_at)}
              </div>
            </div>
          </div>
        </DrawerDetailSection>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            onClick={() =>
              copyText(outage.target)
            }
          >
            Copy target
          </button>

          <button
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() =>
              copyText(outage.start_error)
            }
            disabled={!outage.start_error}
          >
            Copy cause
          </button>
        </div>

        <DrawerDetailSection label="Cause summary">
          <div className="text-sm text-zinc-200">
            {summarizedCause}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Technical cause">
          <div className="whitespace-pre-wrap break-words text-sm text-zinc-200">
            {outage.start_error ?? "—"}
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Recovery note">
          <div className="whitespace-pre-wrap break-words text-sm text-zinc-200">
            {outage.end_note ?? "—"}
          </div>
        </DrawerDetailSection>
      </div>
    </SideDrawer>
  );
}
