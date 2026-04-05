type StatusBadgeProps = {
  ok: boolean;
  activeOutage?: boolean;
};

export default function StatusBadge({ ok, activeOutage = false }: StatusBadgeProps) {
  const text = activeOutage ? "Active outage" : ok ? "Healthy" : "Degraded";
  const classes = activeOutage
    ? "bg-red-950 text-red-300 border-red-800"
    : ok
    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
    : "bg-amber-950 text-amber-300 border-amber-800";

  return <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>{text}</span>;
}
