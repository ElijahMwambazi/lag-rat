type EndpointStatus = {
  name: string;
  status: "ok" | "loading" | "error";
  detail: string;
};

type DebugPanelProps = {
  endpoints: EndpointStatus[];
};

export default function DebugPanel({ endpoints }: DebugPanelProps) {
  const total = endpoints.length;
  const ok = endpoints.filter((item) => item.status === "ok").length;
  const loading = endpoints.filter((item) => item.status === "loading").length;
  const error = endpoints.filter((item) => item.status === "error").length;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">API debug</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {ok}/{total} healthy · {loading} loading · {error} failing
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs ${
            error > 0
              ? "border-red-800 bg-red-950 text-red-300"
              : loading > 0
              ? "border-amber-800 bg-amber-950 text-amber-300"
              : "border-emerald-800 bg-emerald-950 text-emerald-300"
          }`}
        >
          {error > 0 ? "Errors detected" : loading > 0 ? "Loading" : "Connected"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {endpoints.map((endpoint) => (
          <div
            key={endpoint.name}
            className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{endpoint.name}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  endpoint.status === "ok"
                    ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                    : endpoint.status === "error"
                    ? "border-red-800 bg-red-950 text-red-300"
                    : "border-amber-800 bg-amber-950 text-amber-300"
                }`}
              >
                {endpoint.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{endpoint.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
