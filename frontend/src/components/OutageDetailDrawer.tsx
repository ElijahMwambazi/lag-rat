import SideDrawer from "./SideDrawer";
import type { Outage } from "../services/api";

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
  if (!open || !outage) {
    return null;
  }

  return (
    <SideDrawer
      open={open}
      title={outage.outage_type}
      subtitle="Outage details"
      onClose={onClose}
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Target
        </div>
        <div className="mt-2 break-all text-zinc-100">
          {outage.target}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Started
          </div>
          <div className="mt-2 text-zinc-100">
            {formatDate(outage.started_at)}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Ended
          </div>
          <div className="mt-2 text-zinc-100">
            {formatDate(outage.ended_at)}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Duration
          </div>
          <div className="mt-2 text-zinc-100">
            {formatDuration(
              outage.duration_seconds,
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Status
          </div>
          <div className="mt-2 text-zinc-100">
            {outage.status}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Error
        </div>
        <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
          {outage.start_error ?? "—"}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Recovery note
        </div>
        <div className="mt-2 whitespace-pre-wrap break-words text-zinc-100">
          {outage.end_note ?? "—"}
        </div>
      </div>
    </SideDrawer>
  );
}
