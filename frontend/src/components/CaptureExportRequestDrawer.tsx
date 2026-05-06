import { type CaptureExportRequest } from "../services/api";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";

type Props = {
  request: CaptureExportRequest | null;
  open: boolean;
  onClose: () => void;
  onQueue: (request: CaptureExportRequest) => void;
  onCancel: (request: CaptureExportRequest) => void;
  onDelete: (request: CaptureExportRequest) => void;
  queuePending?: boolean;
  cancelPending?: boolean;
  deletePending?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatCaptureSource(value: string) {
  return value.replace(/_/g, " ");
}

function formatCaptureTarget(item: CaptureExportRequest) {
  return (
    item.device_ip_address ??
    item.mac_address ??
    item.entity_key ??
    item.interface_name ??
    "—"
  );
}

function formatCaptureStatus(status: string) {
  switch (status) {
    case "requested":
      return "Requested";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

function getCaptureStatusClasses(status: string) {
  switch (status) {
    case "completed":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
    case "failed":
      return "border-red-800 bg-red-950 text-red-300";
    case "cancelled":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
    case "running":
      return "border-cyan-800 bg-cyan-950 text-cyan-300";
    case "queued":
      return "border-blue-800 bg-blue-950 text-blue-300";
    case "requested":
    default:
      return "border-amber-800 bg-amber-950 text-amber-300";
  }
}

function canQueueCaptureRequest(item: CaptureExportRequest) {
  return item.status === "requested";
}

function canCancelCaptureRequest(item: CaptureExportRequest) {
  return ["requested", "queued", "running"].includes(item.status);
}

function canDeleteCaptureRequest(item: CaptureExportRequest) {
  return item.status !== "running";
}

function TimelineItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-600" />
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="mt-1 text-sm text-zinc-200">{formatDate(value)}</div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value?: string | number | null;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-sm text-zinc-200",
          breakAll ? "break-all" : "",
        ].join(" ")}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function CaptureExportRequestDrawer({
  request,
  open,
  onClose,
  onQueue,
  onCancel,
  onDelete,
  queuePending = false,
  cancelPending = false,
  deletePending = false,
}: Props) {
  if (!open || !request) return null;

  return (
    <SideDrawer
      open={open}
      title={`Capture request · #${request.id}`}
      subtitle={`${formatCaptureSource(request.source)} · ${formatCaptureTarget(
        request,
      )}`}
      onClose={onClose}
      widthClass="max-w-2xl"
    >
      <div className="space-y-6">
        <DrawerDetailSection label="Status">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs",
                  getCaptureStatusClasses(request.status),
                ].join(" ")}
              >
                {formatCaptureStatus(request.status)}
              </span>

              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                {request.interface_name ?? "Unknown interface"}
              </span>

              {request.window_minutes ? (
                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                  {request.window_minutes}m window
                </span>
              ) : null}
            </div>

            <p className="text-sm leading-6 text-zinc-400">
              This request records packet-capture handoff metadata. Lag Rat can
              coordinate guarded local captures, but packet inspection still
              belongs in external tools like tcpdump or Wireshark.
            </p>
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Lifecycle">
          <div className="space-y-4">
            <TimelineItem label="Created" value={request.created_at} />
            <TimelineItem label="Queued" value={request.queued_at} />
            <TimelineItem label="Started" value={request.started_at} />
            <TimelineItem label="Completed" value={request.completed_at} />
            <TimelineItem label="Failed" value={request.failed_at} />
            <TimelineItem label="Cancelled" value={request.cancelled_at} />
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Scope">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem
              label="Source"
              value={formatCaptureSource(request.source)}
            />
            <DetailItem label="Interface" value={request.interface_name} />
            <DetailItem label="Entity type" value={request.entity_type} />
            <DetailItem
              label="Entity key"
              value={request.entity_key}
              breakAll
            />
            <DetailItem label="Device IP" value={request.device_ip_address} />
            <DetailItem label="MAC address" value={request.mac_address} />
          </div>
        </DrawerDetailSection>

        <DrawerDetailSection label="Capture file">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem
              label="Duration"
              value={
                request.duration_seconds ? `${request.duration_seconds}s` : null
              }
            />
            <DetailItem
              label="File size"
              value={formatBytes(request.file_size_bytes)}
            />
            <DetailItem
              label="Output filename"
              value={request.output_filename}
              breakAll
            />
            <DetailItem
              label="Capture reference"
              value={request.capture_reference}
              breakAll
            />
          </div>
        </DrawerDetailSection>

        {request.failure_reason ? (
          <DrawerDetailSection label="Failure reason">
            <p className="text-sm leading-6 text-red-200">
              {request.failure_reason}
            </p>
          </DrawerDetailSection>
        ) : null}

        {request.note ? (
          <DrawerDetailSection label="Note">
            <p className="text-sm leading-6 text-zinc-300">{request.note}</p>
          </DrawerDetailSection>
        ) : null}

        <DrawerDetailSection label="Actions">
          <div className="flex flex-wrap gap-2">
            {canQueueCaptureRequest(request) ? (
              <button
                type="button"
                onClick={() => onQueue(request)}
                disabled={queuePending}
                className="rounded-xl border border-cyan-800 bg-cyan-950 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Queue request
              </button>
            ) : null}

            {canCancelCaptureRequest(request) ? (
              <button
                type="button"
                onClick={() => onCancel(request)}
                disabled={cancelPending}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel request
              </button>
            ) : null}

            {canDeleteCaptureRequest(request) ? (
              <button
                type="button"
                onClick={() => onDelete(request)}
                disabled={deletePending}
                className="rounded-xl border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-100 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete request
              </button>
            ) : null}
          </div>
        </DrawerDetailSection>
      </div>
    </SideDrawer>
  );
}
