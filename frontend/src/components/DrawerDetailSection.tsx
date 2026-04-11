import type { ReactNode } from "react";

type DrawerDetailSectionProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export default function DrawerDetailSection({
  label,
  children,
  className = "",
}: DrawerDetailSectionProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 ${className}`.trim()}
    >
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-zinc-100">
        {children}
      </div>
    </div>
  );
}
