import QueryState from "./QueryState";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartCardProps = {
  title: string;
  data: Array<{ timestamp: string; value: number }>;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

export default function ChartCard({
  title,
  data,
  isLoading = false,
  isError = false,
  errorMessage,
}: ChartCardProps) {
  if (isError) {
    return (
      <QueryState
        title={title}
        tone="error"
        message={errorMessage ?? "This chart could not be loaded."}
      />
    );
  }

  if (isLoading && data.length === 0) {
    return (
      <QueryState
        title={title}
        tone="neutral"
        message="Loading chart data..."
      />
    );
  }

  if (data.length === 0) {
    return (
      <QueryState
        title={title}
        tone="warning"
        message="No data points available yet."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="mb-4 text-lg font-medium">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...data].reverse()}>
            <XAxis dataKey="timestamp" hide />
            <YAxis />
            <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} />
            <Line type="monotone" dataKey="value" dot={false} stroke="currentColor" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
