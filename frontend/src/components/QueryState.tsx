type QueryStateProps = {
  title?: string;
  message: string;
  tone?: "neutral" | "error" | "warning";
};

export default function QueryState({
  title,
  message,
  tone = "neutral",
}: QueryStateProps) {
  const toneClasses =
    tone === "error"
      ? "border-red-900 bg-red-950/40 text-red-200"
      : tone === "warning"
      ? "border-amber-900 bg-amber-950/40 text-amber-200"
      : "border-zinc-800 bg-zinc-900 text-zinc-300";

  return (
    <div className={`rounded-2xl border p-5 ${toneClasses}`}>
      {title ? <h3 className="text-base font-medium">{title}</h3> : null}
      <p className={title ? "mt-2 text-sm" : "text-sm"}>{message}</p>
    </div>
  );
}
