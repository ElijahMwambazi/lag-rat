import type { ReactNode } from "react";

type SideDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export default function SideDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-xl",
}: SideDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className={`h-full w-full ${widthClass} overflow-y-auto border-l border-zinc-800 bg-zinc-900 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-zinc-100 sm:text-xl">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
