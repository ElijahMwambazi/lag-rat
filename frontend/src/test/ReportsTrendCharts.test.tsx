import {
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportsTrendCharts from "../components/ReportsTrendCharts";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

describe("ReportsTrendCharts", () => {
  it("renders error state", () => {
    render(
      <ReportsTrendCharts
        data={[]}
        isError
        errorMessage="trend request failed"
      />,
    );

    expect(
      screen.getByText("Reports trends"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("trend request failed"),
    ).toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(
      <ReportsTrendCharts data={[]} isLoading />,
    );

    expect(
      screen.getByText("Loading trend charts..."),
    ).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<ReportsTrendCharts data={[]} />);

    expect(
      screen.getByText(
        "No trend buckets available yet.",
      ),
    ).toBeInTheDocument();
  });

  it("renders charts when data exists", () => {
    render(
      <ReportsTrendCharts
        data={[
          {
            bucket_start: "2026-04-11T10:00:00Z",
            label: "10:00",
            outage_count: 1,
            dns_failure_count: 0,
            internet_http_failure_count: 1,
            internet_tcp_failure_count: 0,
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Outages over time"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Failures by service"),
    ).toBeInTheDocument();

    expect(
      screen.getAllByTestId("recharts-line-chart")
        .length,
    ).toBeGreaterThan(0);
  });
});
