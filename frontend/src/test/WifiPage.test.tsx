import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import WifiPage from "../pages/WifiPage";
import { renderWithQueryClient } from "./render";

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock("../services/api", () => ({
  api: {
    getWifiLocations: vi.fn(),
    getWifiSummary: vi.fn(),
    getWifiSamples: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("WifiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      api.getWifiLocations,
    ).mockResolvedValue({
      items: ["office", "bedroom"],
    });
  });

  it("renders room comparison, wifi summary, and recent samples", async () => {
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

    renderWithQueryClient(<WifiPage />);

    expect(
      await screen.findByText("Wi-Fi"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Room comparison"),
    ).toBeInTheDocument();

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

    renderWithQueryClient(<WifiPage />);

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

  it("filters to a room when a comparison card is clicked", async () => {
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

    renderWithQueryClient(<WifiPage />);

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
  });

  it("renders empty state when no wifi samples exist", async () => {
    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
      window_minutes: 60,
      location_label: null,
      sample_count: 0,
      avg_rssi_dbm: null,
      min_rssi_dbm: null,
      max_rssi_dbm: null,
      latest_sample: null,
    });

    vi.mocked(
      api.getWifiSamples,
    ).mockResolvedValue([]);

    renderWithQueryClient(<WifiPage />);

    expect(
      await screen.findAllByText(
        "No Wi-Fi samples found in this window.",
      ),
    ).toHaveLength(4);
    expect(
      await screen.findByText(
        "No Wi-Fi samples were recorded in this window yet.",
      ),
    ).toBeInTheDocument();
  });

  it("clears the active room filter", async () => {
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

    renderWithQueryClient(<WifiPage />);

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
      await screen.findByText(
        "Viewing: All locations",
      ),
    ).toBeInTheDocument();
  });
});
