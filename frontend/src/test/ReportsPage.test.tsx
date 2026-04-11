import { screen } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import ReportsPage from "../pages/ReportsPage";
import { renderWithQueryClient } from "./render";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock(
  "../components/OutageDetailDrawer",
  () => ({
    default: () => null,
  }),
);

vi.mock("../utils/incidentText", () => ({
  buildAlertHeadline: () =>
    "Web connectivity check failed",
  buildAlertSubtext: () => ({
    targetLabel: "Target: https://example.com",
  }),
  formatAlertEventTransition: () =>
    "Alert recovered",
  formatIncidentState: (value: string) =>
    value === "active" ? "Ongoing" : "Recovered",
  formatIncidentType: () => "Web connectivity",
  summarizeOutageCause: () =>
    "Web probe request failed",
}));

vi.mock("../services/api", () => ({
  api: {
    getReportsSummary: vi.fn(),
    getReportTrends: vi.fn(),
    getRecentReportAlertEvents: vi.fn(),
    getRecentReportDeviceEvents: vi.fn(),
    getTopIncidentTargets: vi.fn(),
    getOutages: vi.fn(),
    getReportsSnapshot: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows reports summary failure state", async () => {
    vi.mocked(
      api.getReportsSummary,
    ).mockRejectedValue(
      new Error("reports summary failed"),
    );
    vi.mocked(
      api.getReportTrends,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportAlertEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportDeviceEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getTopIncidentTargets,
    ).mockResolvedValue([]);
    vi.mocked(api.getOutages).mockResolvedValue(
      [],
    );

    renderWithQueryClient(<ReportsPage />);

    expect(
      await screen.findByText(
        "Reports summary request failed",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("reports summary failed"),
    ).toBeInTheDocument();
  });

  it("shows empty recent alert events state", async () => {
    vi.mocked(
      api.getReportsSummary,
    ).mockResolvedValue({
      window_hours: 24,
      uptime_pct: 99.9,
      avg_latency_ms: 15,
      outage_count: 0,
      total_downtime_seconds: 0,
      dns_failure_count: 0,
      device_history_event_count: 0,
      active_alert_count: 0,
      active_critical_alert_count: 0,
      active_unacknowledged_alert_count: 0,
    });
    vi.mocked(
      api.getReportTrends,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportAlertEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportDeviceEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getTopIncidentTargets,
    ).mockResolvedValue([]);
    vi.mocked(api.getOutages).mockResolvedValue(
      [],
    );

    renderWithQueryClient(<ReportsPage />);

    expect(
      await screen.findByText(
        "No recent alert events were recorded in this window.",
      ),
    ).toBeInTheDocument();
  });
});
