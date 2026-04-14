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

  it("renders wifi summary and recent samples", async () => {
    vi.mocked(
      api.getWifiSummary,
    ).mockResolvedValue({
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
      await screen.findByText("Recent samples"),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("-42 dBm"),
    ).toHaveLength(2);

    expect(
      await screen.findByText("5180 MHz"),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("5ghz"),
    ).toHaveLength(3);

    expect(
      await screen.findAllByText("office"),
    ).toHaveLength(3);
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
});
