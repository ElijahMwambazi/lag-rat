import { screen } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import MetricsPage from "../pages/MetricsPage";
import { renderWithQueryClient } from "./render";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock("../services/api", () => ({
  api: {
    getHealthHistory: vi.fn(),
    getHealthHistoryTcp: vi.fn(),
    getDnsHistory: vi.fn(),
    getMetricsSummary: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("MetricsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows summary failure separately from chart failures", async () => {
    vi.mocked(
      api.getHealthHistory,
    ).mockResolvedValue([
      {
        timestamp: "2026-04-11T10:00:00Z",
        value: 20,
      },
    ]);
    vi.mocked(
      api.getHealthHistoryTcp,
    ).mockResolvedValue([
      {
        timestamp: "2026-04-11T10:00:00Z",
        value: 15,
      },
    ]);
    vi.mocked(
      api.getDnsHistory,
    ).mockResolvedValue([
      {
        timestamp: "2026-04-11T10:00:00Z",
        value: 10,
      },
    ]);
    vi.mocked(
      api.getMetricsSummary,
    ).mockRejectedValue(
      new Error("summary failed"),
    );

    renderWithQueryClient(<MetricsPage />);

    expect(
      await screen.findByText(
        "Metrics summary request failed",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("summary failed"),
    ).toBeInTheDocument();
  });

  it("shows empty-window state when summary and charts have no data", async () => {
    vi.mocked(
      api.getHealthHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getHealthHistoryTcp,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getDnsHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getMetricsSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          key: "internet_http",
          label: "Internet HTTP",
          total_checks: 0,
          success_count: 0,
          failure_count: 0,
          success_rate_pct: 0,
          avg_latency_ms: 0,
          latest_latency_ms: null,
          last_checked_at: null,
        },
        {
          key: "internet_tcp",
          label: "Internet TCP",
          total_checks: 0,
          success_count: 0,
          failure_count: 0,
          success_rate_pct: 0,
          avg_latency_ms: 0,
          latest_latency_ms: null,
          last_checked_at: null,
        },
        {
          key: "dns",
          label: "DNS",
          total_checks: 0,
          success_count: 0,
          failure_count: 0,
          success_rate_pct: 0,
          avg_latency_ms: 0,
          latest_latency_ms: null,
          last_checked_at: null,
        },
      ],
    });

    renderWithQueryClient(<MetricsPage />);

    expect(
      await screen.findByText(
        "No metrics recorded in this window",
      ),
    ).toBeInTheDocument();
  });
});
