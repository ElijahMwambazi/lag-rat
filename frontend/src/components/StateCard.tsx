type StateCardTone =
  | "neutral"
  | "warning"
  | "error";

type StateCardProps = {
  title: string;
  message: string;
  tone?: StateCardTone;
};

export default function StateCard({
  title,
  message,
  tone = "neutral",
}: StateCardProps) {
  const toneClasses =
    tone === "error"
      ? "border-red-900 bg-red-950/40 text-red-300"
      : tone === "warning"
        ? "border-amber-900 bg-amber-950/40 text-amber-300"
        : "border-zinc-800 bg-zinc-900 text-zinc-400";

  return (
    <div
      className={`rounded-2xl border p-5 ${toneClasses}`}
    >
      <h3 className="text-lg font-medium">
        {title}
      </h3>
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}
