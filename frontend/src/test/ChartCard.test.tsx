import {
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChartCard from "../components/ChartCard";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

describe("ChartCard", () => {
  it("renders error state", () => {
    render(
      <ChartCard
        title="Internet HTTP latency"
        data={[]}
        isError
        errorMessage="chart failed"
      />,
    );

    expect(
      screen.getByText("Internet HTTP latency"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("chart failed"),
    ).toBeInTheDocument();
  });

  it("renders loading state when empty and loading", () => {
    render(
      <ChartCard
        title="Internet HTTP latency"
        data={[]}
        isLoading
      />,
    );

    expect(
      screen.getByText("Loading chart data..."),
    ).toBeInTheDocument();
  });

  it("renders empty state when no data points exist", () => {
    render(
      <ChartCard
        title="Internet HTTP latency"
        data={[]}
      />,
    );

    expect(
      screen.getByText(
        "No data points available yet.",
      ),
    ).toBeInTheDocument();
  });

  it("renders chart when data exists", () => {
    render(
      <ChartCard
        title="Internet HTTP latency"
        data={[
          {
            timestamp: "2026-04-11T10:00:00Z",
            value: 20,
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Internet HTTP latency"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("recharts-line-chart"),
    ).toBeInTheDocument();
  });
});
