import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import WifiPage from "../pages/WifiPage";
import { renderWithQueryClient } from "./render";
import { api } from "../services/api";

function mockWifiLocationSummaries() {
  vi.mocked(
    api.getWifiLocationSummaries,
  ).mockResolvedValue({
    window_minutes: 60,
    items: [
      {
        location_label: "office",
        sample_count: 2,
        avg_rssi_dbm: -45,
        min_rssi_dbm: -48,
        max_rssi_dbm: -42,
        latest_sample: {
          id: 2,
          location_label: "office",
          interface_name: "wlo1",
          ssid: "TheReal",
          bssid: "d5:8a:f7:59:88:f1",
          rssi_dbm: -42,
          frequency_mhz: 5180,
          band: "5ghz",
          sampled_at: new Date().toISOString(),
        },
      },
      {
        location_label: "bedroom",
        sample_count: 1,
        avg_rssi_dbm: -58,
        min_rssi_dbm: -58,
        max_rssi_dbm: -58,
        latest_sample: {
          id: 3,
          location_label: "bedroom",
          interface_name: "wlo1",
          ssid: "TheReal",
          bssid: "d5:8a:f7:59:88:f1",
          rssi_dbm: -58,
          frequency_mhz: 5180,
          band: "5ghz",
          sampled_at: new Date(
            Date.now() - 2 * 60 * 1000,
          ).toISOString(),
        },
      },
    ],
  });
}

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock("../services/api", () => ({
  api: {
    acknowledgeAlert: vi.fn(),
    getAlertHistory: vi.fn(),
    getAlerts: vi.fn(),
    getWifiLocations: vi.fn(),
    getWifiSummary: vi.fn(),
    getWifiLocationSummaries: vi.fn(),
    getWifiSamples: vi.fn(),
  },
}));

describe("WifiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      api.getWifiLocations,
    ).mockResolvedValue({
      items: ["office", "bedroom"],
    });
    vi.mocked(api.getAlerts).mockResolvedValue(
      [],
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({
      id: 11,
      alert_type: "wifi_signal_weak",
      severity: "warning",
      entity_type: "wifi",
      entity_key: "bedroom",
      message:
        "wifi signal is weak in bedroom: -58 dBm",
      is_active: true,
      created_at: new Date().toISOString(),
      resolved_at: null,
      acknowledged_at: new Date().toISOString(),
    });
  });

  it("renders room comparison, wifi summary, and recent samples", async () => {
    mockWifiLocationSummaries();

    vi.mocked(
      api.getWifiSummary,
    ).mockImplementation(
      async (params?: {
        minutes?: number;
        location_label?: string;
      }) => {
        if (
          params?.location_label === "bedroom"
        ) {
          return {
            window_minutes: 60,
            location_label: "bedroom",
            sample_count: 1,
            avg_rssi_dbm: -58,
            min_rssi_dbm: -58,
            max_rssi_dbm: -58,
            latest_sample: {
              id: 3,
              location_label: "bedroom",
              interface_name: "wlo1",
              ssid: "TheReal",
              bssid: "d5:8a:f7:59:88:f1",
              rssi_dbm: -58,
              frequency_mhz: 5180,
              band: "5ghz",
              sampled_at: new Date(
                Date.now() - 2 * 60 * 1000,
              ).toISOString(),
            },
          };
        }

        return {
          window_minutes: 60,
          location_label:
            params?.location_label ?? "office",
          sample_count: 2,
          avg_rssi_dbm: -45,
          min_rssi_dbm: -48,
          max_rssi_dbm: -42,
          latest_sample: {
            id: 2,
            location_label: "office",
            interface_name: "wlo1",
            ssid: "TheReal",
            bssid: "d5:8a:f7:59:88:f1",
            rssi_dbm: -42,
            frequency_mhz: 5180,
            band: "5ghz",
            sampled_at: new Date().toISOString(),
          },
        };
      },
    );

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 2,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
      {
        id: 1,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -48,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date(
          Date.now() - 5 * 60 * 1000,
        ).toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/wifi"]}>
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Wi-Fi"),
    ).toBeInTheDocument();

    expect(
      (
        await screen.findAllByText(
          "Room comparison",
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      await screen.findByText(
        "Viewing: All locations",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("Selected"),
    ).toHaveLength(1);

    expect(
      await screen.findAllByText("All locations"),
    ).toHaveLength(2);

    expect(
      await screen.findAllByText("office"),
    ).toHaveLength(4);

    expect(
      await screen.findAllByText("bedroom"),
    ).toHaveLength(2);

    expect(
      await screen.findAllByText("-42 dBm"),
    ).toHaveLength(3);

    expect(
      await screen.findByText("-58 dBm"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Recent samples"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("5180 MHz"),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("5ghz"),
    ).toHaveLength(5);
  });

  it("updates room filter UX when a comparison card is clicked", async () => {
    mockWifiLocationSummaries();

    vi.mocked(
      api.getWifiSummary,
    ).mockImplementation(
      async (params?: {
        minutes?: number;
        location_label?: string;
      }) => {
        if (
          params?.location_label === "bedroom"
        ) {
          return {
            window_minutes: 60,
            location_label: "bedroom",
            sample_count: 1,
            avg_rssi_dbm: -58,
            min_rssi_dbm: -58,
            max_rssi_dbm: -58,
            latest_sample: {
              id: 3,
              location_label: "bedroom",
              interface_name: "wlo1",
              ssid: "TheReal",
              bssid: "d5:8a:f7:59:88:f1",
              rssi_dbm: -58,
              frequency_mhz: 5180,
              band: "5ghz",
              sampled_at:
                new Date().toISOString(),
            },
          };
        }

        return {
          window_minutes: 60,
          location_label: "office",
          sample_count: 2,
          avg_rssi_dbm: -45,
          min_rssi_dbm: -48,
          max_rssi_dbm: -42,
          latest_sample: {
            id: 2,
            location_label: "office",
            interface_name: "wlo1",
            ssid: "TheReal",
            bssid: "d5:8a:f7:59:88:f1",
            rssi_dbm: -42,
            frequency_mhz: 5180,
            band: "5ghz",
            sampled_at: new Date().toISOString(),
          },
        };
      },
    );

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/wifi"]}>
        <WifiPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /bedroom/i,
      }),
    );

    expect(
      await screen.findByText(
        "Last 1h · bedroom",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Viewing: bedroom"),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: /clear room filter/i,
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Recent samples · bedroom",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Filtered to bedroom",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("Selected"),
    ).toHaveLength(1);
  });

  it("renders empty state when no wifi samples exist", async () => {
    vi.mocked(
      api.getWifiLocationSummaries,
    ).mockResolvedValue({
      window_minutes: 60,
      items: [],
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/wifi"]}>
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "No data points available yet.",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "No Wi-Fi samples were recorded in this window yet.",
      ),
    ).toBeInTheDocument();
  });

  it("clears the active room filter", async () => {
    mockWifiLocationSummaries();

    vi.mocked(
      api.getWifiSummary,
    ).mockImplementation(
      async (params?: {
        minutes?: number;
        location_label?: string;
      }) => {
        if (
          params?.location_label === "bedroom"
        ) {
          return {
            window_minutes: 60,
            location_label: "bedroom",
            sample_count: 1,
            avg_rssi_dbm: -58,
            min_rssi_dbm: -58,
            max_rssi_dbm: -58,
            latest_sample: {
              id: 3,
              location_label: "bedroom",
              interface_name: "wlo1",
              ssid: "TheReal",
              bssid: "d5:8a:f7:59:88:f1",
              rssi_dbm: -58,
              frequency_mhz: 5180,
              band: "5ghz",
              sampled_at:
                new Date().toISOString(),
            },
          };
        }

        return {
          window_minutes: 60,
          location_label: "office",
          sample_count: 2,
          avg_rssi_dbm: -45,
          min_rssi_dbm: -48,
          max_rssi_dbm: -42,
          latest_sample: {
            id: 2,
            location_label: "office",
            interface_name: "wlo1",
            ssid: "TheReal",
            bssid: "d5:8a:f7:59:88:f1",
            rssi_dbm: -42,
            frequency_mhz: 5180,
            band: "5ghz",
            sampled_at: new Date().toISOString(),
          },
        };
      },
    );

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /bedroom/i,
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: /clear room filter/i,
      }),
    );

    expect(
      (
        await screen.findAllByText(
          "Viewing: All locations",
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows room health badges from active wifi alerts", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: null,
      sample_count: 2,
      avg_rssi_dbm: -45,
      min_rssi_dbm: -58,
      max_rssi_dbm: -42,
      latest_sample: {
        id: 2,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 2,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/wifi"]}>
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Weak"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Healthy"),
    ).toBeInTheDocument();
  });

  it("shows stale badge when a room has an active stale alert", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 21,
        alert_type: "wifi_samples_stale",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "office",
        message:
          "wifi samples are getting stale in office: last sample 8m ago",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: null,
      sample_count: 2,
      avg_rssi_dbm: -45,
      min_rssi_dbm: -58,
      max_rssi_dbm: -42,
      latest_sample: {
        id: 2,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 2,
        location_label: "office",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -42,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/wifi"]}>
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Stale"),
    ).toBeInTheDocument();
  });

  it("initializes room filter from query params", async () => {
    mockWifiLocationSummaries();

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      (
        await screen.findAllByText(
          "Viewing: bedroom",
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      (
        await screen.findAllByText(
          "Last 1h · bedroom",
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      await screen.findByText(
        "Recent samples · bedroom",
      ),
    ).toBeInTheDocument();
  });

  it("renders selected room status panel for a filtered room", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "Selected room status",
      ),
    ).toBeInTheDocument();

    expect(
      (await screen.findAllByText("Weak")).length,
    ).toBeGreaterThan(0);

    expect(
      (
        await screen.findAllByText(
          "wifi signal is weak in bedroom: -58 dBm",
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      await screen.findByText(
        "Samples in window",
      ),
    ).toBeInTheDocument();
  });

  it("shows healthy selected room status when no wifi alerts are active", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue(
      [],
    );

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "Selected room status",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Healthy"),
    ).toBeInTheDocument();

    expect(
      (
        await screen.findAllByText(
          "No active Wi-Fi alerts for this room.",
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders selected room incident timeline", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([
      {
        id: 1,
        alert_id: 11,
        event_type: "opened",
        previous_value: null,
        new_value: "warning",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        alert_id: 11,
        event_type: "severity_changed",
        previous_value: "warning",
        new_value: "critical",
        created_at: new Date().toISOString(),
      },
      {
        id: 3,
        alert_id: 11,
        event_type: "acknowledged",
        previous_value: null,
        new_value: null,
        created_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "Room incident timeline",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Opened"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Severity changed"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Acknowledged"),
    ).toBeInTheDocument();
  });

  it("acknowledges selected room alert from the drawer", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([
      {
        id: 1,
        alert_id: 11,
        event_type: "opened",
        previous_value: null,
        new_value: "warning",
        created_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    await user.click(
      (
        await screen.findAllByRole("button", {
          name: /view alert details/i,
        })
      )[0],
    );

    await user.click(
      await screen.findByRole("button", {
        name: /^acknowledge$/i,
      }),
    );

    expect(
      api.acknowledgeAlert,
    ).toHaveBeenCalledWith(11);
  });

  it("opens alert detail drawer from selected room panel", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);

    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([
      {
        id: 1,
        alert_id: 11,
        event_type: "opened",
        previous_value: null,
        new_value: "warning",
        created_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    await user.click(
      (
        await screen.findAllByRole("button", {
          name: /view alert details/i,
        })
      )[0],
    );

    expect(
      await screen.findByRole("button", {
        name: /^acknowledge$/i,
      }),
    ).toBeInTheDocument();

    expect(
      (
        await screen.findAllByText(
          /wifi signal is weak in bedroom: -58 dBm/i,
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      (await screen.findAllByText(/timeline/i))
        .length,
    ).toBeGreaterThan(0);
  });

  it("shows acknowledged state instead of inline acknowledge buttons", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 11,
        alert_type: "wifi_signal_weak",
        severity: "warning",
        entity_type: "wifi",
        entity_key: "bedroom",
        message:
          "wifi signal is weak in bedroom: -58 dBm",
        is_active: true,
        created_at: new Date().toISOString(),
        resolved_at: null,
        acknowledged_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([
      {
        id: 1,
        alert_id: 11,
        event_type: "opened",
        previous_value: null,
        new_value: "warning",
        created_at: new Date().toISOString(),
      },
    ]);

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findAllByText("Acknowledged"),
    ).toHaveLength(2);

    expect(
      screen.queryByRole("button", {
        name: /acknowledge alert/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("renders recent recoveries for the selected room", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockImplementation(
      async (params?: {
        status?: "active" | "resolved";
        severity?: string;
        entity_type?: string;
        search?: string;
        limit?: number;
      }) => {
        if (params?.status === "resolved") {
          return [
            {
              id: 31,
              alert_type: "wifi_signal_weak",
              severity: "warning",
              entity_type: "wifi",
              entity_key: "bedroom",
              message:
                "wifi signal recovered in bedroom after weak signal",
              is_active: false,
              created_at: new Date(
                Date.now() - 30 * 60 * 1000,
              ).toISOString(),
              resolved_at: new Date(
                Date.now() - 10 * 60 * 1000,
              ).toISOString(),
              acknowledged_at: null,
            },
          ];
        }

        return [];
      },
    );

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "Recent recoveries",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        /wifi signal recovered in bedroom after weak signal/i,
      ),
    ).toBeInTheDocument();

    expect(
      (await screen.findAllByText(/Resolved/i))
        .length,
    ).toBeGreaterThan(0);
  });

  it("opens alert detail drawer from a recent recovery", async () => {
    mockWifiLocationSummaries();

    vi.mocked(api.getAlerts).mockImplementation(
      async (params?: {
        status?: "active" | "resolved";
        severity?: string;
        entity_type?: string;
        search?: string;
        limit?: number;
      }) => {
        if (params?.status === "resolved") {
          return [
            {
              id: 31,
              alert_type: "wifi_signal_weak",
              severity: "warning",
              entity_type: "wifi",
              entity_key: "bedroom",
              message:
                "wifi signal recovered in bedroom after weak signal",
              is_active: false,
              created_at: new Date(
                Date.now() - 30 * 60 * 1000,
              ).toISOString(),
              resolved_at: new Date(
                Date.now() - 10 * 60 * 1000,
              ).toISOString(),
              acknowledged_at: null,
            },
          ];
        }

        return [];
      },
    );

    vi.mocked(
      api.getAlertHistory,
    ).mockImplementation(
      async (alertId: number) => {
        if (alertId === 31) {
          return [
            {
              id: 91,
              alert_id: 31,
              event_type: "opened",
              previous_value: null,
              new_value: "warning",
              created_at: new Date(
                Date.now() - 30 * 60 * 1000,
              ).toISOString(),
            },
            {
              id: 92,
              alert_id: 31,
              event_type: "resolved",
              previous_value: "warning",
              new_value: "resolved",
              created_at: new Date(
                Date.now() - 10 * 60 * 1000,
              ).toISOString(),
            },
          ];
        }

        return [];
      },
    );

    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: "bedroom",
      sample_count: 1,
      avg_rssi_dbm: -58,
      min_rssi_dbm: -58,
      max_rssi_dbm: -58,
      latest_sample: {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([
      {
        id: 3,
        location_label: "bedroom",
        interface_name: "wlo1",
        ssid: "TheReal",
        bssid: "d5:8a:f7:59:88:f1",
        rssi_dbm: -58,
        frequency_mhz: 5180,
        band: "5ghz",
        sampled_at: new Date().toISOString(),
      },
    ]);

    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        initialEntries={[
          "/wifi?location=bedroom&minutes=60",
        ]}
      >
        <WifiPage />
      </MemoryRouter>,
    );

    const alertButtons =
      await screen.findAllByRole("button", {
        name: /view alert details/i,
      });
    await user.click(
      alertButtons[alertButtons.length - 1]!,
    );

    expect(
      (
        await screen.findAllByText(
          /wifi signal recovered in bedroom after weak signal/i,
        )
      ).length,
    ).toBeGreaterThan(0);

    expect(
      (await screen.findAllByText(/Resolved/i))
        .length,
    ).toBeGreaterThan(0);
  });
});
