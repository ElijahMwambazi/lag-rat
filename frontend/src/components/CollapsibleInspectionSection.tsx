import type { ReactNode } from "react";

type CollapsibleInspectionSectionProps = {
  title: string;
  description: string;
  badges?: ReactNode;
  collapsedSummary: string;
  collapsedDetail: string;
  collapsedActionLabel: string;
  expandedActionLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function getExpandToggleButtonClasses(
  expanded: boolean,
) {
  return expanded
    ? "rounded-full border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-900"
    : "rounded-full border border-cyan-700 bg-cyan-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-cyan-500";
}

export default function CollapsibleInspectionSection({
  title,
  description,
  badges,
  collapsedSummary,
  collapsedDetail,
  collapsedActionLabel,
  expandedActionLabel,
  isExpanded,
  onToggle,
  children,
}: CollapsibleInspectionSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">
            {title}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {badges}
          {isExpanded ? (
            <button
              type="button"
              onClick={onToggle}
              className={getExpandToggleButtonClasses(
                true,
              )}
            >
              {expandedActionLabel}
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        children
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm leading-6 text-zinc-400">
            {collapsedSummary}
          </div>

          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            {badges ? (
              <div className="flex flex-wrap items-center gap-2">
                {badges}
              </div>
            ) : null}

            <p className="text-sm text-zinc-400">
              {collapsedDetail}
            </p>

            <div>
              <button
                type="button"
                onClick={onToggle}
                className={getExpandToggleButtonClasses(
                  false,
                )}
              >
                {collapsedActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
