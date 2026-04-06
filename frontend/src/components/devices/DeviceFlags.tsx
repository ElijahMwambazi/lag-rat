import type { Device } from "../../services/api";

type Props = {
  device: Device;
};

export default function DeviceFlags({
  device,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {device.confidence === "high" ? (
        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
          High confidence
        </span>
      ) : device.confidence === "medium" ? (
        <span className="rounded-full border border-sky-800 bg-sky-950 px-2 py-0.5 text-xs text-sky-300">
          Medium confidence
        </span>
      ) : (
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">
          Low confidence
        </span>
      )}

      {device.is_gateway ? (
        <span className="rounded-full border border-sky-800 bg-sky-950 px-2 py-0.5 text-xs text-sky-300">
          Gateway
        </span>
      ) : null}

      {device.is_known ? (
        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
          Known
        </span>
      ) : null}

      {device.is_recent ? (
        <span className="rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
          Recent
        </span>
      ) : null}
    </div>
  );
}
