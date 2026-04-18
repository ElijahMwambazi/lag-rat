import type { ReactNode } from "react";

type PageFilterBarProps = {
  title: string;
  description?: string;
  controls?: ReactNode;
  children?: ReactNode;
};

export default function PageFilterBar({
  title,
  description,
  controls,
  children,
}: PageFilterBarProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>

        {controls ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {controls}
          </div>
        ) : null}
      </div>

      {children ? (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}
