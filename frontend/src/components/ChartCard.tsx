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
  data: Array<{
    timestamp: string;
    value: number;
  }>;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

function formatXAxisLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = Math.abs(
    now.getTime() - parsed.getTime(),
  );
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24) {
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return parsed.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatTooltipLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

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
        message={
          errorMessage ??
          "This chart could not be loaded."
        }
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

  const chartData = [...data].reverse();

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="mb-4 text-lg font-medium">
        {title}
      </h3>

      <div className="h-80">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={chartData}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxisLabel}
              minTickGap={24}
              tick={{
                fontSize: 12,
                fill: "#a1a1aa",
              }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={{ stroke: "#3f3f46" }}
            />

            <YAxis
              tick={{
                fontSize: 12,
                fill: "#a1a1aa",
              }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={{ stroke: "#3f3f46" }}
            />

            <Tooltip
              labelFormatter={formatTooltipLabel}
              formatter={(value: number) => [
                `${value.toFixed(1)} ms`,
                "Latency",
              ]}
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
              }}
            />

            <Line
              type="monotone"
              dataKey="value"
              dot={false}
              stroke="currentColor"
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
