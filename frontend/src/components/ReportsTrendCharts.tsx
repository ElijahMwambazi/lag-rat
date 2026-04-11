import QueryState from "./QueryState";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ReportTrendPoint } from "../services/api";

type ReportsTrendChartsProps = {
  data: ReportTrendPoint[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

export default function ReportsTrendCharts({
  data,
  isLoading = false,
  isError = false,
  errorMessage,
}: ReportsTrendChartsProps) {
  if (isError) {
    return (
      <QueryState
        title="Reports trends"
        tone="error"
        message={
          errorMessage ??
          "The reports trend charts could not be loaded."
        }
      />
    );
  }

  if (isLoading && data.length === 0) {
    return (
      <QueryState
        title="Reports trends"
        tone="neutral"
        message="Loading trend charts..."
      />
    );
  }

  if (data.length === 0) {
    return (
      <QueryState
        title="Reports trends"
        tone="warning"
        message="No trend buckets available yet."
      />
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-4 text-lg font-medium">
          Outages over time
        </h3>
        <div className="h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="opacity-20"
              />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="outage_count"
                dot={false}
                stroke="currentColor"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-4 text-lg font-medium">
          Failures by service
        </h3>
        <div className="h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="opacity-20"
              />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="internet_http_failure_count"
                name="HTTP"
                dot={false}
                stroke="#f59e0b"
              />
              <Line
                type="monotone"
                dataKey="internet_tcp_failure_count"
                name="TCP"
                dot={false}
                stroke="#38bdf8"
              />
              <Line
                type="monotone"
                dataKey="dns_failure_count"
                name="DNS"
                dot={false}
                stroke="#34d399"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
