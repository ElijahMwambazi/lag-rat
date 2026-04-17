import QueryState from "./QueryState";
import React from "react";

type DataTableCardVariant = "default" | "flush";

type DataTableCardProps = {
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
  helperText?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  hasData: boolean;
  children: React.ReactNode;
  tableMinWidthClassName?: string;
  variant?: DataTableCardVariant;
  hideHeader?: boolean;
};

export default function DataTableCard({
  title,
  description,
  rightSlot,
  helperText,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyTitle,
  emptyMessage = "No records available yet.",
  hasData,
  children,
  tableMinWidthClassName = "min-w-full",
  variant = "default",
  hideHeader = false,
}: DataTableCardProps) {
  const isFlush = variant === "flush";

  return (
    <section
      className={
        isFlush
          ? ""
          : "rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      }
    >
      {!hideHeader ? (
        <div
          className={
            isFlush
              ? "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              : "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          }
        >
          <div>
            <h3 className="text-lg font-medium">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>

          {rightSlot ? rightSlot : null}
        </div>
      ) : null}

      {helperText ? (
        <div
          className={
            isFlush
              ? "rounded-t-2xl border border-zinc-800 border-b-0 bg-zinc-950/40 px-4 py-3 text-sm leading-6 text-zinc-400"
              : "-mx-5 mb-0 rounded-none border-y border-zinc-800 bg-zinc-950/40 px-5 py-3 text-sm leading-6 text-zinc-400"
          }
        >
          {helperText}
        </div>
      ) : null}

      {isLoading && !hasData ? (
        <QueryState
          title={emptyTitle ?? title}
          message="Loading data..."
        />
      ) : isError ? (
        <QueryState
          title={emptyTitle ?? title}
          tone="error"
          message={
            errorMessage ??
            "This table could not be loaded."
          }
        />
      ) : !hasData ? (
        <QueryState
          title={emptyTitle ?? title}
          tone="warning"
          message={emptyMessage}
        />
      ) : isFlush ? (
        <div className="overflow-hidden rounded-b-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <div
              className={tableMinWidthClassName}
            >
              {children}
            </div>
          </div>
        </div>
      ) : (
        <div className="-mx-5 mt-0 overflow-hidden rounded-b-2xl border-t border-zinc-800">
          <div className="overflow-x-auto">
            <div
              className={tableMinWidthClassName}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
