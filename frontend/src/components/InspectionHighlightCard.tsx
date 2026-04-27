import type { ReactNode } from "react";

type InspectionHighlightMetric = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusBadgeClassName?: string;
  primaryLabel: string;
  primaryValue: string;
  metrics: InspectionHighlightMetric[];
  footerLabel?: string;
  footerValue?: string;
  actionHint?: string;
  onClick?: () => void;
  ariaLabel?: string;
  secondaryActionLabel?: string;
  secondaryActionAriaLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  children?: ReactNode;
};

export default function InspectionHighlightCard({
  title,
  subtitle,
  statusLabel,
  statusBadgeClassName = "border-zinc-700 bg-zinc-950 text-zinc-300",
  primaryLabel,
  primaryValue,
  metrics,
  footerLabel,
  footerValue,
  actionHint,
  onClick,
  ariaLabel,
  secondaryActionLabel,
  secondaryActionAriaLabel,
  onSecondaryAction,
  className = "",
  children,
}: Props) {
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">
            {title}
          </div>

          {subtitle ? (
            <div className="mt-1 truncate text-xs text-zinc-500">
              {subtitle}
            </div>
          ) : null}
        </div>

        {statusLabel ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs ${statusBadgeClassName}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {primaryLabel}
        </div>
        <div className="mt-1 text-2xl font-semibold text-zinc-100">
          {primaryValue}
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
            >
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                {metric.label}
              </div>
              <div className="mt-1 text-sm text-zinc-100">{metric.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}

      {footerLabel || footerValue || actionHint ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {footerLabel ? (
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                {footerLabel}
              </div>
            ) : null}

            {footerValue ? (
              <div className="mt-1 truncate text-sm text-zinc-300">
                {footerValue}
              </div>
            ) : null}
          </div>

          {actionHint ? (
            <div className="text-xs text-zinc-500 transition group-hover:text-zinc-400">
              {actionHint}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (onClick && onSecondaryAction) {
    return (
      <div
        className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-zinc-700 hover:bg-zinc-900 ${className}`.trim()}
      >
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className="group block w-full text-left"
        >
          {content}
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
          <button
            type="button"
            aria-label={secondaryActionAriaLabel ?? secondaryActionLabel}
            onClick={onSecondaryAction}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            {secondaryActionLabel}
          </button>
        </div>
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className={`group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900 ${className}`.trim()}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 ${className}`.trim()}
    >
      {content}
    </div>
  );
}
