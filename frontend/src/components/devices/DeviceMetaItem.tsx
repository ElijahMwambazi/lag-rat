type Props = {
  label: string;
  value: string;
};

export default function DeviceMetaItem({
  label,
  value,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 break-all text-sm text-zinc-100">
        {value}
      </div>
    </div>
  );
}
