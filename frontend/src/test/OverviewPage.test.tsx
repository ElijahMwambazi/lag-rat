import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "../pages/OverviewPage";
import { renderWithQueryClient } from "./render";
import { api } from "../services/api";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock("../components/alerts/AlertsPanel", () => ({
  default: ({
    focusMode = "default",
    selectedAlertId = null,
  }: {
    focusMode?: string;
    selectedAlertId?: number | null;
  }) => (
    <div>
      <div>Alerts panel</div>
      <div>{`focusMode:${focusMode}`}</div>
      <div>{`selectedAlertId:${selectedAlertId ?? "none"}`}</div>
    </div>
  ),
}));

vi.mock("../utils/incidentText", async () => {
  const actual = await vi.importActual<typeof import("../utils/incidentText")>(
    "../utils/incidentText",
  );

  return {
    ...actual,
  };
});

vi.mock("../services/api", () => ({
  api: {
    getStatusOverview: vi.fn(),
    getSummary: vi.fn(),
    getAlerts: vi.fn(),
    getWifiLocationSummaries: vi.fn(),
    getTrafficSummary: vi.fn(),
  },
}));

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getWifiLocationSummaries).mockRejectedValue(
      new Error("Wi-Fi summaries unavailable"),
    );

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 40_000_000,
      total_bytes_tx: 70_000_000,
      total_bytes: 110_000_000,
      interface_count: 4,
      top_talker: {
        interface_name: "docker0",
        entity_type: "interface",
        entity_key: "docker0",
        device_ip_address: null,
        mac_address: null,
        latest_bytes_rx: 8_000_000,
        latest_bytes_tx: 9_000_000,
        earliest_bytes_rx: 8_000_000,
        earliest_bytes_tx: 9_000_000,
        delta_bytes_rx: 0,
        delta_bytes_tx: 0,
        delta_bytes_total: 0,
        latest_sampled_at: new Date().toISOString(),
      },
    });
  });

  it("renders overview failure state", async () => {
    vi.mocked(api.getStatusOverview).mockRejectedValue(
      new Error("Overview exploded"),
    );
    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 99.9,
      avg_latency_ms_24h: 18,
      outage_count_24h: 1,
    });
    vi.mocked(api.getAlerts).mockResolvedValue([]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Overview request failed"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Overview exploded").length).toBeGreaterThan(0);
  });

  it("renders critical alert banner when critical unacknowledged alerts exist", async () => {
    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        status: "healthy",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: false,
        status: "down",
        last_success_at: "2026-04-11T11:30:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_tcp: {
        is_healthy: false,
        status: "down",
        last_success_at: null,
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_http: {
        is_healthy: false,
        status: "down",
        last_success_at: null,
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_response_time_ms: 20,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        active_count_24h: 7,
        most_recent_seen_at: "2026-04-11T11:50:00Z",
      },
      outages: {
        active_count: 1,
        last_24h_count: 2,
      },
      alerts: {
        active_count: 2,
        active_critical_count: 1,
        active_unacknowledged_count: 1,
        active_unacknowledged_critical_count: 1,
        most_recent_created_at: "2026-04-11T11:58:00Z",
      },
    });

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 97.5,
      avg_latency_ms_24h: 22,
      outage_count_24h: 2,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 1,
        alert_type: "service_health",
        severity: "critical",
        entity_type: "internet_http",
        entity_key: "https://example.com",
        message: "internet_http check failed: timeout",
        is_active: true,
        created_at: "2026-04-11T11:58:00Z",
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Immediate attention needed"),
    ).toBeInTheDocument();

    expect(screen.getByText("Review alerts")).toBeInTheDocument();

    expect(screen.getByText("Take action")).toBeInTheDocument();

    expect(screen.getByText("Activity snapshot")).toBeInTheDocument();

    expect(await screen.findByText("Traffic (1h)")).toBeInTheDocument();

    expect(await screen.findByText("Top talker")).toBeInTheDocument();

    expect(await screen.findByText("docker0")).toBeInTheDocument();

    expect(
      await screen.findByText("4 interfaces observed"),
    ).toBeInTheDocument();
  });

  it("opens the selected critical alert in the alerts panel", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: false,
        last_success_at: "2026-04-11T11:30:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_tcp: {
        is_healthy: false,
        last_success_at: null,
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_http: {
        is_healthy: false,
        last_success_at: null,
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: null,
        latest_error_message: "timeout",
        active_outage: true,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_response_time_ms: 20,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        active_count_24h: 7,
        most_recent_seen_at: "2026-04-11T11:50:00Z",
      },
      outages: {
        active_count: 1,
        last_24h_count: 2,
      },
      alerts: {
        active_count: 2,
        active_critical_count: 1,
        active_unacknowledged_count: 1,
        active_unacknowledged_critical_count: 1,
        most_recent_created_at: "2026-04-11T11:58:00Z",
      },
    });

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 97.5,
      avg_latency_ms_24h: 22,
      outage_count_24h: 2,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 1,
        alert_type: "service_health",
        severity: "critical",
        entity_type: "internet_http",
        entity_key: "https://example.com",
        message: "internet_http check failed: timeout",
        is_active: true,
        created_at: "2026-04-11T11:58:00Z",
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Open alert details",
      }),
    );

    expect(screen.getByText("focusMode:active-critical")).toBeInTheDocument();

    expect(screen.getByText("selectedAlertId:1")).toBeInTheDocument();
  });

  it("renders traffic fallback state when traffic summary is unavailable", async () => {
    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_latency_ms: 12,
        latest_error_message: null,
        active_outage: false,
      },
      internet_tcp: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_latency_ms: 11,
        latest_error_message: null,
        active_outage: false,
      },
      internet_http: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_latency_ms: 13,
        latest_error_message: null,
        active_outage: false,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:58:00Z",
        last_failure_at: null,
        latest_latency_ms: 21,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        total_devices: 8,
        active_devices_24h: 5,
        new_devices_24h: 1,
        latest_seen_at: "2026-04-11T11:57:00Z",
      },
      outages: {
        active_count: 0,
        total_24h: 0,
        latest_started_at: null,
      },
      alerts: {
        active_count: 0,
        critical_count: 0,
        unacknowledged_count: 0,
        latest_created_at: null,
      },
    } as never);

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 99.9,
      avg_latency_ms_24h: 18,
      outage_count_24h: 0,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([]);

    vi.mocked(api.getTrafficSummary).mockRejectedValue(
      new Error("Traffic summary unavailable"),
    );

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Traffic (1h)")).toBeInTheDocument();

    expect(await screen.findByText("Top talker")).toBeInTheDocument();

    expect(
      await screen.findByText("Traffic summary unavailable"),
    ).toBeInTheDocument();
  });

  it("renders wifi health summary card", async () => {
    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 18,
        latest_error_message: null,
        active_outage: false,
      },
      internet_tcp: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 12,
        latest_error_message: null,
        active_outage: false,
      },
      internet_http: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 20,
        latest_error_message: null,
        active_outage: false,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_response_time_ms: 16,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        active_count_24h: 7,
        most_recent_seen_at: "2026-04-11T11:50:00Z",
      },
      outages: {
        active_count: 0,
        last_24h_count: 0,
      },
      alerts: {
        active_count: 0,
        active_critical_count: 0,
        active_unacknowledged_count: 0,
        active_unacknowledged_critical_count: 0,
        most_recent_created_at: null,
      },
    });

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 99.9,
      avg_latency_ms_24h: 18,
      outage_count_24h: 0,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([]);

    vi.mocked(api.getWifiLocationSummaries).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          location_label: "office",
          sample_count: 3,
          avg_rssi_dbm: -45,
          min_rssi_dbm: -48,
          max_rssi_dbm: -42,
          latest_sample: {
            id: 1,
            location_label: "office",
            interface_name: "wlan0",
            ssid: "LagRatNet",
            bssid: "aa:bb:cc:dd:ee:ff",
            rssi_dbm: -42,
            frequency_mhz: 5180,
            band: "5ghz",
            sampled_at: "2026-04-11T11:59:30Z",
          },
        },
        {
          location_label: "bedroom",
          sample_count: 2,
          avg_rssi_dbm: -71,
          min_rssi_dbm: -74,
          max_rssi_dbm: -68,
          latest_sample: {
            id: 2,
            location_label: "bedroom",
            interface_name: "wlan0",
            ssid: "LagRatNet",
            bssid: "aa:bb:cc:dd:ee:ff",
            rssi_dbm: -74,
            frequency_mhz: 2412,
            band: "2.4ghz",
            sampled_at: "2026-04-11T11:58:30Z",
          },
        },
        {
          location_label: "garage",
          sample_count: 0,
          avg_rssi_dbm: null,
          min_rssi_dbm: null,
          max_rssi_dbm: null,
          latest_sample: null,
        },
      ],
    });

    vi.mocked(api.getWifiLocationSummaries).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          location_label: "office",
          sample_count: 3,
          avg_rssi_dbm: -45,
          min_rssi_dbm: -48,
          max_rssi_dbm: -42,
          latest_sample: {
            id: 1,
            location_label: "office",
            interface_name: "wlan0",
            ssid: "LagRatNet",
            bssid: "aa:bb:cc:dd:ee:ff",
            rssi_dbm: -42,
            frequency_mhz: 5180,
            band: "5ghz",
            sampled_at: "2026-04-11T11:59:30Z",
          },
        },
        {
          location_label: "bedroom",
          sample_count: 2,
          avg_rssi_dbm: -71,
          min_rssi_dbm: -74,
          max_rssi_dbm: -68,
          latest_sample: {
            id: 2,
            location_label: "bedroom",
            interface_name: "wlan0",
            ssid: "LagRatNet",
            bssid: "aa:bb:cc:dd:ee:ff",
            rssi_dbm: -74,
            frequency_mhz: 2412,
            band: "2.4ghz",
            sampled_at: "2026-04-11T11:58:30Z",
          },
        },
        {
          location_label: "garage",
          sample_count: 0,
          avg_rssi_dbm: null,
          min_rssi_dbm: null,
          max_rssi_dbm: null,
          latest_sample: null,
        },
      ],
    });

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Weakest room: bedroom"),
    ).toBeInTheDocument();

    expect(await screen.findByText("-74 dBm")).toBeInTheDocument();

    expect(await screen.findByText("Rooms reporting")).toBeInTheDocument();

    expect(await screen.findByText("Stale rooms")).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: "Open weakest room",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: "Open Wi-Fi page",
      }),
    ).toBeInTheDocument();
  });

  it("shows degraded internet state when some internet probes are failing", async () => {
    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        status: "healthy",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: true,
        status: "degraded",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: 20,
        latest_error_message:
          "Some internet probe targets are failing, but at least one internet path is reachable.",
        active_outage: true,
      },
      internet_tcp: {
        is_healthy: true,
        status: "degraded",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: 20,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_http: {
        is_healthy: true,
        status: "healthy",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 40,
        latest_error_message: null,
        active_outage: false,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_response_time_ms: 18,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        active_count_24h: 2,
        most_recent_seen_at: "2026-04-11T11:58:00Z",
      },
      outages: {
        active_count: 1,
        last_24h_count: 1,
      },
      alerts: {
        active_count: 0,
        active_critical_count: 0,
        active_unacknowledged_count: 0,
        active_unacknowledged_critical_count: 0,
        most_recent_created_at: null,
      },
    });

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 99.9,
      avg_latency_ms_24h: 18,
      outage_count_24h: 1,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Internet degraded")).toBeInTheDocument();
    expect(await screen.findAllByText("Degraded")).not.toHaveLength(0);
    expect(
      await screen.findByText(
        /Some internet probe targets are failing, but at least one internet path is reachable/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows degraded internet state when some internet probes are failing", async () => {
    vi.mocked(api.getStatusOverview).mockResolvedValue({
      checked_at: "2026-04-11T12:00:00Z",
      router: {
        is_healthy: true,
        status: "healthy",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 3,
        latest_error_message: null,
        active_outage: false,
      },
      internet: {
        is_healthy: true,
        status: "degraded",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: 20,
        latest_error_message:
          "Some internet probe targets are failing, but at least one internet path is reachable.",
        active_outage: true,
      },
      internet_tcp: {
        is_healthy: true,
        status: "degraded",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: "2026-04-11T11:58:00Z",
        latest_latency_ms: 20,
        latest_error_message: "timeout",
        active_outage: true,
      },
      internet_http: {
        is_healthy: true,
        status: "healthy",
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_latency_ms: 40,
        latest_error_message: null,
        active_outage: false,
      },
      dns: {
        is_healthy: true,
        last_success_at: "2026-04-11T11:59:00Z",
        last_failure_at: null,
        latest_response_time_ms: 18,
        latest_error_message: null,
        active_outage: false,
      },
      devices: {
        active_count_24h: 2,
        most_recent_seen_at: "2026-04-11T11:58:00Z",
      },
      outages: {
        active_count: 1,
        last_24h_count: 1,
      },
      alerts: {
        active_count: 0,
        active_critical_count: 0,
        active_unacknowledged_count: 0,
        active_unacknowledged_critical_count: 0,
        most_recent_created_at: null,
      },
    });

    vi.mocked(api.getSummary).mockResolvedValue({
      uptime_pct_24h: 99.9,
      avg_latency_ms_24h: 18,
      outage_count_24h: 1,
    });

    vi.mocked(api.getAlerts).mockResolvedValue([]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Internet degraded")).toBeInTheDocument();
    expect(await screen.findAllByText("Degraded")).not.toHaveLength(0);
    expect(
      await screen.findByText(
        /Some internet probe targets are failing, but at least one internet path is reachable/i,
      ),
    ).toBeInTheDocument();
  });
});
