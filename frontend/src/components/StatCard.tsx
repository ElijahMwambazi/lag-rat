type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export default function StatCard({
  label,
  value,
  hint,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-3 break-words text-2xl font-semibold leading-tight sm:text-3xl">
        {value}
      </p>

      {hint ? (
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
