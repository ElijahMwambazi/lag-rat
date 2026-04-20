import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrafficPage from "../pages/TrafficPage";
import { api } from "../services/api";
import { renderWithQueryClient } from "./render";
import userEvent from "@testing-library/user-event";

vi.mock("../services/api", () => ({
  api: {
    getTrafficSummary: vi.fn(),
    getTrafficTopTalkers: vi.fn(),
    getTrafficSamples: vi.fn(),
  },
}));

describe("TrafficPage", () => {
  it("renders traffic summary and top talkers", async () => {
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

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
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
          latest_sampled_at: new Date().toISOString(),
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
          latest_sampled_at: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(api.getTrafficSamples).mockResolvedValue([
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
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic"]}
      >
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Traffic")).toBeInTheDocument();

    expect(await screen.findByText("Traffic summary")).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Interfaces ranked by traffic delta over the selected window.",
      ),
    ).toBeInTheDocument();

    expect(await screen.findAllByText("docker0")).not.toHaveLength(0);

    expect(await screen.findAllByText("eth0")).toHaveLength(5);

    expect(
      await screen.findByText(
        "Most recent interface counter samples captured in the selected window.",
      ),
    ).toBeInTheDocument();

    expect(await screen.findAllByText("docker0")).not.toHaveLength(0);

    expect(await screen.findAllByText("eth0")).toHaveLength(5);
  });

  it("filters top talkers and recent samples by selected interface", async () => {
    const user = userEvent.setup();

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

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
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
          latest_sampled_at: new Date().toISOString(),
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
          latest_sampled_at: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(api.getTrafficSamples).mockResolvedValue([
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
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic"]}
      >
        <TrafficPage />
      </MemoryRouter>,
    );

    const interfaceSelect = await screen.findByRole("combobox", {
      name: "Traffic interface",
    });

    expect(
      await within(interfaceSelect).findByRole("option", { name: "eth0" }),
    ).toBeInTheDocument();

    await user.selectOptions(interfaceSelect, "eth0");

    expect(screen.getByText("Interface · eth0")).toBeInTheDocument();

    expect(screen.getByDisplayValue("eth0")).toBeInTheDocument();

    expect(
      screen.queryByRole("option", {
        name: "docker0",
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText("eth0")).toHaveLength(5);
  });

  it("keeps matching rows visible when the selected interface exists", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 10_000_000,
      total_bytes_tx: 12_000_000,
      total_bytes: 22_000_000,
      interface_count: 1,
      top_talker: {
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        latest_bytes_rx: 5_000_000,
        latest_bytes_tx: 7_000_000,
        earliest_bytes_rx: 1_000_000,
        earliest_bytes_tx: 2_000_000,
        delta_bytes_rx: 4_000_000,
        delta_bytes_tx: 5_000_000,
        delta_bytes_total: 9_000_000,
        latest_sampled_at: new Date().toISOString(),
      },
    });

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          interface_name: "eth0",
          entity_type: "interface",
          entity_key: "eth0",
          device_ip_address: null,
          mac_address: null,
          latest_bytes_rx: 5_000_000,
          latest_bytes_tx: 7_000_000,
          earliest_bytes_rx: 1_000_000,
          earliest_bytes_tx: 2_000_000,
          delta_bytes_rx: 4_000_000,
          delta_bytes_tx: 5_000_000,
          delta_bytes_total: 9_000_000,
          latest_sampled_at: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(api.getTrafficSamples).mockResolvedValue([
      {
        id: 1,
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        bytes_rx: 5_000_000,
        bytes_tx: 7_000_000,
        packets_rx: 1000,
        packets_tx: 1100,
        sampled_at: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic"]}
      >
        <TrafficPage />
      </MemoryRouter>,
    );

    const interfaceSelect = await screen.findByRole("combobox", {
      name: "Traffic interface",
    });

    expect(
      await within(interfaceSelect).findByRole("option", { name: "eth0" }),
    ).toBeInTheDocument();

    await user.selectOptions(interfaceSelect, "eth0");

    expect(screen.getByText("Interface · eth0")).toBeInTheDocument();

    expect(screen.getAllByText("eth0")).not.toHaveLength(0);
  });
});
