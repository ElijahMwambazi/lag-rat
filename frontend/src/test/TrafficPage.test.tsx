import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrafficPage from "../pages/TrafficPage";
import { api } from "../services/api";
import { renderWithQueryClient } from "./render";

vi.mock("../services/api", () => ({
  api: {
    getTrafficSummary: vi.fn(),
    getTrafficTopTalkers: vi.fn(),
    getTrafficSamples: vi.fn(),
  },
}));

describe("TrafficPage", () => {
  it("renders traffic summary and top talkers", async () => {
    vi.mocked(
      api.getTrafficSummary,
    ).mockResolvedValue({
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
        latest_sampled_at:
          new Date().toISOString(),
      },
    });

    vi.mocked(
      api.getTrafficTopTalkers,
    ).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
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
          latest_sampled_at:
            new Date().toISOString(),
        },
        {
          interface_name: "eth0",
          entity_type: "interface",
          entity_key: "eth0",
          device_ip_address: null,
          mac_address: null,
          latest_bytes_rx: 20_000_000,
          latest_bytes_tx: 30_000_000,
          earliest_bytes_rx: 10_000_000,
          earliest_bytes_tx: 15_000_000,
          delta_bytes_rx: 10_000_000,
          delta_bytes_tx: 15_000_000,
          delta_bytes_total: 25_000_000,
          latest_sampled_at:
            new Date().toISOString(),
        },
      ],
    });

    vi.mocked(
      api.getTrafficSamples,
    ).mockResolvedValue([
      {
        id: 1,
        interface_name: "docker0",
        entity_type: "interface",
        entity_key: "docker0",
        device_ip_address: null,
        mac_address: null,
        bytes_rx: 8_000_000,
        bytes_tx: 9_000_000,
        packets_rx: 1200,
        packets_tx: 1300,
        sampled_at: new Date().toISOString(),
      },
      {
        id: 2,
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        bytes_rx: 20_000_000,
        bytes_tx: 30_000_000,
        packets_rx: 4200,
        packets_tx: 5100,
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/traffic"]}>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Traffic"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Traffic summary"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Interfaces ranked by traffic delta over the selected window.",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("docker0"),
    ).not.toHaveLength(0);

    expect(
      await screen.findAllByText("eth0"),
    ).toHaveLength(4);

    expect(
      await screen.findByText(
        "Most recent interface counter samples captured in the selected window.",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findAllByText("docker0"),
    ).not.toHaveLength(0);

    expect(
      await screen.findAllByText("eth0"),
    ).toHaveLength(4);
  });
});
