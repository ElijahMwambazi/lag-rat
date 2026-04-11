import type { PropsWithChildren } from "react";

export function ResponsiveContainer({
  children,
}: PropsWithChildren) {
  return (
    <div data-testid="recharts-responsive">
      {children}
    </div>
  );
}

export function LineChart({
  children,
}: PropsWithChildren) {
  return (
    <div data-testid="recharts-line-chart">
      {children}
    </div>
  );
}

export function Line() {
  return null;
}

export function XAxis() {
  return null;
}

export function YAxis() {
  return null;
}

export function Tooltip() {
  return null;
}

export function CartesianGrid() {
  return null;
}

export function Legend() {
  return null;
}
