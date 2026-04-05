type StatCardProps = { label: string; value: string; hint?: string; };
export default function StatCard({ label, value, hint }: StatCardProps) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"><p className="text-sm text-zinc-400">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p>{hint ? <p className="mt-2 text-sm text-zinc-500">{hint}</p> : null}</div>;
}
