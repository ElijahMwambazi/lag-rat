import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    getWifiSamples: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("MetricsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([]);
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

  it("renders latest wifi summary and wifi trend chart", async () => {
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
    ).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          key: "internet_http",
          label: "Internet HTTP",
          total_checks: 12,
          success_count: 11,
          failure_count: 1,
          success_rate_pct: 91.7,
          avg_latency_ms: 18.4,
          latest_latency_ms: 22.1,
          last_checked_at: "2026-04-11T10:00:00Z",
        },
        {
          key: "internet_tcp",
          label: "Internet TCP",
          total_checks: 12,
          success_count: 12,
          failure_count: 0,
          success_rate_pct: 100,
          avg_latency_ms: 14.2,
          latest_latency_ms: 13.6,
          last_checked_at: "2026-04-11T10:00:00Z",
        },
        {
          key: "dns",
          label: "DNS",
          total_checks: 12,
          success_count: 10,
          failure_count: 2,
          success_rate_pct: 83.3,
          avg_latency_ms: 9.8,
          latest_latency_ms: 8.5,
          last_checked_at: "2026-04-11T10:00:00Z",
        },
      ],
    });

    const now = Date.now();

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 2,
        location_label: "office",
        interface_name: "wlan0",
        ssid: "LagRatNet",
        bssid: "aa:bb:cc:dd:ee:ff",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date(
          now - 5 * 60 * 1000,
        ).toISOString(),
      },
      {
        id: 1,
        location_label: "office",
        interface_name: "wlan0",
        ssid: "LagRatNet",
        bssid: "aa:bb:cc:dd:ee:ff",
        rssi_dbm: -48,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date(
          now - 20 * 60 * 1000,
        ).toISOString(),
      },
    ]);

    renderWithQueryClient(<MetricsPage />);

    expect(
      await screen.findByText("Wi-Fi signal"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("office"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("LagRatNet"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("-42 dBm"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("5180 MHz"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Wi-Fi signal strength · Last 1h",
      ),
    ).toBeInTheDocument();
  });

  it("shows wifi empty state when no wifi samples exist in the selected window", async () => {
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
    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([]);

    renderWithQueryClient(<MetricsPage />);

    expect(
      await screen.findByText(
        "No Wi-Fi samples were recorded in this window yet.",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Wi-Fi signal strength · Last 1h",
      ),
    ).toBeInTheDocument();
  });
});

it("shows chart failure state when all chart requests fail", async () => {
  vi.mocked(
    api.getHealthHistory,
  ).mockRejectedValue(new Error("http failed"));
  vi.mocked(
    api.getHealthHistoryTcp,
  ).mockRejectedValue(new Error("tcp failed"));
  vi.mocked(api.getDnsHistory).mockRejectedValue(
    new Error("dns failed"),
  );
  vi.mocked(
    api.getMetricsSummary,
  ).mockResolvedValue({
    window_minutes: 60,
    items: [
      {
        key: "internet_http",
        label: "Internet HTTP",
        total_checks: 5,
        success_count: 4,
        failure_count: 1,
        success_rate_pct: 80,
        avg_latency_ms: 20,
        latest_latency_ms: 25,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
    ],
  });

  renderWithQueryClient(<MetricsPage />);

  expect(
    await screen.findByText(
      "Metric charts request failed",
    ),
  ).toBeInTheDocument();

  expect(
    screen.getByText(
      "All chart endpoints failed. Check the backend and API base URL.",
    ),
  ).toBeInTheDocument();
});

it("renders populated summary cards", async () => {
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
  vi.mocked(api.getDnsHistory).mockResolvedValue([
    {
      timestamp: "2026-04-11T10:00:00Z",
      value: 10,
    },
  ]);
  vi.mocked(
    api.getMetricsSummary,
  ).mockResolvedValue({
    window_minutes: 60,
    items: [
      {
        key: "internet_http",
        label: "Internet HTTP",
        total_checks: 12,
        success_count: 11,
        failure_count: 1,
        success_rate_pct: 91.7,
        avg_latency_ms: 18.4,
        latest_latency_ms: 22.1,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
      {
        key: "internet_tcp",
        label: "Internet TCP",
        total_checks: 12,
        success_count: 12,
        failure_count: 0,
        success_rate_pct: 100,
        avg_latency_ms: 14.2,
        latest_latency_ms: 13.6,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
      {
        key: "dns",
        label: "DNS",
        total_checks: 12,
        success_count: 10,
        failure_count: 2,
        success_rate_pct: 83.3,
        avg_latency_ms: 9.8,
        latest_latency_ms: 8.5,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
    ],
  });

  renderWithQueryClient(<MetricsPage />);

  expect(
    await screen.findByText("Internet HTTP"),
  ).toBeInTheDocument();

  expect(
    await screen.findByText("91.7%"),
  ).toBeInTheDocument();

  expect(
    screen.getByText("11"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("1"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("18.4 ms"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("22.1 ms"),
  ).toBeInTheDocument();
});

it("shows warning card when a summary item has no checks", async () => {
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
  vi.mocked(api.getDnsHistory).mockResolvedValue([
    {
      timestamp: "2026-04-11T10:00:00Z",
      value: 10,
    },
  ]);
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
        total_checks: 5,
        success_count: 5,
        failure_count: 0,
        success_rate_pct: 100,
        avg_latency_ms: 12,
        latest_latency_ms: 12,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
      {
        key: "dns",
        label: "DNS",
        total_checks: 5,
        success_count: 5,
        failure_count: 0,
        success_rate_pct: 100,
        avg_latency_ms: 8,
        latest_latency_ms: 8,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
    ],
  });

  renderWithQueryClient(<MetricsPage />);

  expect(
    await screen.findByText(
      "No checks were recorded in this window yet.",
    ),
  ).toBeInTheDocument();
});

it("refetches metrics data when the window changes", async () => {
  const user = userEvent.setup();

  vi.mocked(
    api.getHealthHistory,
  ).mockResolvedValue([]);
  vi.mocked(
    api.getHealthHistoryTcp,
  ).mockResolvedValue([]);
  vi.mocked(api.getDnsHistory).mockResolvedValue(
    [],
  );
  vi.mocked(
    api.getMetricsSummary,
  ).mockResolvedValue({
    window_minutes: 60,
    items: [],
  });

  renderWithQueryClient(<MetricsPage />);

  expect(
    await screen.findByDisplayValue("Last 1h"),
  ).toBeInTheDocument();

  await user.selectOptions(
    screen.getByRole("combobox"),
    "1440",
  );

  expect(
    api.getHealthHistory,
  ).toHaveBeenCalledWith(1440);
  expect(
    api.getHealthHistoryTcp,
  ).toHaveBeenCalledWith(1440);
  expect(api.getDnsHistory).toHaveBeenCalledWith(
    1440,
  );
  expect(
    api.getMetricsSummary,
  ).toHaveBeenCalledWith(1440);
});

it("shows status text for populated chart data", async () => {
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
      timestamp: "2026-04-11T10:01:00Z",
      value: 15,
    },
  ]);
  vi.mocked(api.getDnsHistory).mockResolvedValue([
    {
      timestamp: "2026-04-11T10:02:00Z",
      value: 10,
    },
  ]);
  vi.mocked(
    api.getMetricsSummary,
  ).mockResolvedValue({
    window_minutes: 60,
    items: [
      {
        key: "internet_http",
        label: "Internet HTTP",
        total_checks: 1,
        success_count: 1,
        failure_count: 0,
        success_rate_pct: 100,
        avg_latency_ms: 20,
        latest_latency_ms: 20,
        last_checked_at: "2026-04-11T10:00:00Z",
      },
    ],
  });

  renderWithQueryClient(<MetricsPage />);

  expect(
    await screen.findByText(
      "Last 1h · 3 chart points",
    ),
  ).toBeInTheDocument();
});
