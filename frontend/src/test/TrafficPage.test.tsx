import { MemoryRouter, useLocation } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrafficPage from "../pages/TrafficPage";
import { api } from "../services/api";
import { renderWithQueryClient } from "./render";
import userEvent from "@testing-library/user-event";

function LocationSearchProbe() {
  const location = useLocation();

  return (
    <div data-testid="location-search">
      {`${location.pathname}${location.search}`}
    </div>
  );
}

vi.mock("../services/api", () => ({
  api: {
    getTrafficSummary: vi.fn(),
    getTrafficTopTalkers: vi.fn(),
    getTrafficSamples: vi.fn(),
    createCaptureExportRequest: vi.fn(),
    getCaptureReadiness: vi.fn(),
    getCaptureExportRequests: vi.fn(),
    queueCaptureExportRequest: vi.fn(),
    cancelCaptureExportRequest: vi.fn(),
    deleteCaptureExportRequest: vi.fn(),
  },
}));

describe("TrafficPage", () => {
  beforeEach(() => {
    vi.mocked(api.createCaptureExportRequest).mockResolvedValue({
      id: 1,
      source: "traffic_top_talker",
      interface_name: "eth0",
      entity_type: "interface",
      entity_key: "eth0",
      device_ip_address: null,
      mac_address: null,
      window_minutes: 60,
      note: "Capture export requested from traffic top talker drawer",
      status: "requested",
      capture_reference: null,
      created_at: new Date().toISOString(),
    });

    vi.mocked(api.getCaptureReadiness).mockResolvedValue({
      execution_enabled: false,
      can_execute: false,
      tcpdump_available: true,
      output_directory_ready: true,
      duration_bounds_valid: true,
      allowed_interfaces_valid: true,
      allowed_interfaces: ["wlo1"],
      output_dir: "data/captures",
      default_duration_seconds: 30,
      min_duration_seconds: 5,
      max_duration_seconds: 120,
      max_file_mb: 50,
      issues: [
        {
          key: "execution_disabled",
          severity: "warning",
          message: "Capture execution is disabled.",
          action: "Set CAPTURE_EXECUTION_ENABLED=true and restart the backend.",
        },
      ],
    });

    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([]);

    vi.mocked(api.queueCaptureExportRequest).mockResolvedValue({
      id: 1,
      source: "traffic_top_talker",
      interface_name: "eth0",
      entity_type: "interface",
      entity_key: "eth0",
      device_ip_address: null,
      mac_address: null,
      window_minutes: 60,
      note: "Capture this top talker",
      status: "queued",
      capture_reference: null,
      created_at: new Date().toISOString(),
      queued_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      failed_at: null,
      cancelled_at: null,
      failure_reason: null,
      duration_seconds: null,
      output_filename: null,
      file_size_bytes: null,
    });

    vi.mocked(api.cancelCaptureExportRequest).mockResolvedValue({
      id: 1,
      source: "traffic_top_talker",
      interface_name: "eth0",
      entity_type: "interface",
      entity_key: "eth0",
      device_ip_address: null,
      mac_address: null,
      window_minutes: 60,
      note: "Capture this top talker",
      status: "cancelled",
      capture_reference: null,
      created_at: new Date().toISOString(),
      queued_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      failed_at: null,
      cancelled_at: new Date().toISOString(),
      failure_reason: null,
      duration_seconds: null,
      output_filename: null,
      file_size_bytes: null,
    });

    vi.mocked(api.deleteCaptureExportRequest).mockResolvedValue({
      id: 1,
      deleted: true,
      file_deleted: false,
    });
  });

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

    expect(await screen.findByText("Traffic overview")).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Latest raw counter samples captured for the selected interface scope.",
      ),
    ).toBeInTheDocument();

    expect(await screen.findAllByText("docker0")).not.toHaveLength(0);

    expect(await screen.findAllByText("eth0")).toHaveLength(4);

    expect(
      await screen.findByText(
        "Latest raw counter samples captured for the selected interface scope.",
      ),
    ).toBeInTheDocument();

    expect(await screen.findAllByText("docker0")).not.toHaveLength(0);

    expect(await screen.findAllByText("eth0")).toHaveLength(4);
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

    expect(screen.getAllByText("Viewing · eth0").length).toBeGreaterThan(0);

    expect(screen.getByDisplayValue("eth0")).toBeInTheDocument();

    expect(
      screen.queryByRole("option", {
        name: "docker0",
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText("eth0")).toHaveLength(4);
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

    expect(screen.getAllByText("Viewing · eth0").length).toBeGreaterThan(0);

    expect(screen.getAllByText("eth0")).not.toHaveLength(0);
  });

  it("opens a top talker detail drawer when a ranked row is clicked", async () => {
    const user = userEvent.setup();

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

    expect(await screen.findByText("Top talkers")).toBeInTheDocument();

    const topTalkersHeading = screen.getByText("Top talkers");
    const topTalkersSection = topTalkersHeading.closest("section");

    const eth0Cell = within(topTalkersSection as HTMLElement).getAllByText(
      "eth0",
    )[0];

    await user.click(eth0Cell);

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    expect(screen.getByText("Movement summary")).toBeInTheDocument();

    expect(screen.getAllByText("Scope").length).toBeGreaterThan(0);

    expect(screen.getByText("Counters")).toBeInTheDocument();

    expect(screen.getByText("Identifiers")).toBeInTheDocument();

    expect(screen.getAllByText("8.6 MB").length).toBeGreaterThan(0);

    expect(screen.getAllByText("3.8 MB").length).toBeGreaterThan(0);

    expect(screen.getAllByText("4.8 MB").length).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", {
        name: /close/i,
      }),
    ).toBeInTheDocument();
  });

  it("opens device details from the top talker drawer", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 20_000_000,
      total_bytes_tx: 30_000_000,
      total_bytes: 50_000_000,
      interface_count: 1,
      top_talker: {
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.10",
        mac_address: "aa:bb:cc:dd:ee:ff",
        latest_bytes_rx: 8_000_000,
        latest_bytes_tx: 10_000_000,
        earliest_bytes_rx: 4_000_000,
        earliest_bytes_tx: 5_000_000,
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
          device_ip_address: "192.168.1.10",
          mac_address: "aa:bb:cc:dd:ee:ff",
          latest_bytes_rx: 8_000_000,
          latest_bytes_tx: 10_000_000,
          earliest_bytes_rx: 4_000_000,
          earliest_bytes_tx: 5_000_000,
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
        device_ip_address: "192.168.1.10",
        mac_address: "aa:bb:cc:dd:ee:ff",
        bytes_rx: 8_000_000,
        bytes_tx: 10_000_000,
        packets_rx: 1000,
        packets_tx: 1200,
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
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    const topTalkersHeading = await screen.findByText("Top talkers");
    const topTalkersSection = topTalkersHeading.closest("section");

    await user.click(
      within(topTalkersSection as HTMLElement).getAllByText("eth0")[0],
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Open device details",
      }),
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "/devices?",
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceIp=192.168.1.10",
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceMac=aa%3Abb%3Acc%3Add%3Aee%3Aff",
    );
  });

  it("closes the top talker detail drawer", async () => {
    const user = userEvent.setup();

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

    const topTalkersHeading = await screen.findByText("Top talkers");
    const topTalkersSection = topTalkersHeading.closest("section");

    const eth0Cell = within(topTalkersSection as HTMLElement).getAllByText(
      "eth0",
    )[0];

    await user.click(eth0Cell);

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /close/i,
      }),
    );

    expect(screen.queryByText("Top talker · eth0")).not.toBeInTheDocument();
  });

  it("opens the correct top talker drawer after interface filtering", async () => {
    const user = userEvent.setup();

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

    const topTalkersHeading = screen.getByText("Top talkers");
    const topTalkersSection = topTalkersHeading.closest("section");

    const eth0Cell = within(topTalkersSection as HTMLElement).getAllByText(
      "eth0",
    )[0];

    await user.click(eth0Cell);

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    expect(screen.getAllByText("Moderate movement").length).toBeGreaterThan(0);

    expect(screen.getAllByText("8.6 MB").length).toBeGreaterThan(0);

    expect(screen.queryByText("Top talker · docker0")).not.toBeInTheDocument();
  });

  it("renders a top talker highlight strip and opens the drawer from a highlight card", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 50_000_000,
      total_bytes_tx: 60_000_000,
      total_bytes: 110_000_000,
      interface_count: 4,
      top_talker: {
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        latest_bytes_rx: 18_000_000,
        latest_bytes_tx: 22_000_000,
        earliest_bytes_rx: 8_000_000,
        earliest_bytes_tx: 12_000_000,
        delta_bytes_rx: 10_000_000,
        delta_bytes_tx: 10_000_000,
        delta_bytes_total: 20_000_000,
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
          latest_bytes_rx: 18_000_000,
          latest_bytes_tx: 22_000_000,
          earliest_bytes_rx: 8_000_000,
          earliest_bytes_tx: 12_000_000,
          delta_bytes_rx: 10_000_000,
          delta_bytes_tx: 10_000_000,
          delta_bytes_total: 20_000_000,
          latest_sampled_at: new Date().toISOString(),
        },
        {
          interface_name: "wlan0",
          entity_type: "interface",
          entity_key: "wlan0",
          device_ip_address: null,
          mac_address: null,
          latest_bytes_rx: 14_000_000,
          latest_bytes_tx: 16_000_000,
          earliest_bytes_rx: 7_000_000,
          earliest_bytes_tx: 9_000_000,
          delta_bytes_rx: 7_000_000,
          delta_bytes_tx: 7_000_000,
          delta_bytes_total: 14_000_000,
          latest_sampled_at: new Date().toISOString(),
        },
        {
          interface_name: "pppoe0",
          entity_type: "interface",
          entity_key: "pppoe0",
          device_ip_address: null,
          mac_address: null,
          latest_bytes_rx: 9_000_000,
          latest_bytes_tx: 11_000_000,
          earliest_bytes_rx: 4_000_000,
          earliest_bytes_tx: 5_000_000,
          delta_bytes_rx: 5_000_000,
          delta_bytes_tx: 6_000_000,
          delta_bytes_total: 11_000_000,
          latest_sampled_at: new Date().toISOString(),
        },
        {
          interface_name: "docker0",
          entity_type: "interface",
          entity_key: "docker0",
          device_ip_address: null,
          mac_address: null,
          latest_bytes_rx: 8_000_000,
          latest_bytes_tx: 8_000_000,
          earliest_bytes_rx: 8_000_000,
          earliest_bytes_tx: 8_000_000,
          delta_bytes_rx: 0,
          delta_bytes_tx: 0,
          delta_bytes_total: 0,
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
        bytes_rx: 18_000_000,
        bytes_tx: 22_000_000,
        packets_rx: 3000,
        packets_tx: 3500,
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

    expect(
      await screen.findByText("Top talker highlights"),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: "Inspect top talker eth0",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: "Inspect top talker wlan0",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("button", {
        name: "Inspect top talker pppoe0",
      }),
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", {
        name: "Inspect top talker eth0",
      }),
    );

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();
  });

  it("opens a top talker drawer from query params", async () => {
    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={[
          "/traffic?trafficTalkerInterface=eth0&trafficTalkerKey=eth0",
        ]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficTalkerInterface=eth0",
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficTalkerKey=eth0",
    );
  });

  it("opens a traffic sample drawer from query params", async () => {
    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic?trafficSampleId=1"]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Traffic sample · eth0"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficSampleId=1",
    );
  });

  it("clears top talker query params when the drawer closes", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={[
          "/traffic?trafficTalkerInterface=eth0&trafficTalkerKey=eth0",
        ]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /close/i,
      }),
    );

    expect(screen.queryByText("Top talker · eth0")).not.toBeInTheDocument();

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficTalkerInterface",
    );

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficTalkerKey",
    );
  });

  it("clears sample query params when the drawer closes", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic?trafficSampleId=1"]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Traffic sample · eth0"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /close/i,
      }),
    );

    expect(screen.queryByText("Traffic sample · eth0")).not.toBeInTheDocument();

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficSampleId",
    );
  });

  it("opening a top talker clears any sample query param", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/traffic?trafficSampleId=1"]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Traffic sample · eth0"),
    ).toBeInTheDocument();

    const topTalkersHeading = screen.getByText("Top talkers");
    const topTalkersSection = topTalkersHeading.closest("section");

    const eth0Cell = within(topTalkersSection as HTMLElement).getAllByText(
      "eth0",
    )[0];

    await user.click(eth0Cell);

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficSampleId",
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficTalkerInterface=eth0",
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficTalkerKey=eth0",
    );
  });

  it("opening a sample clears any top talker query params", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={[
          "/traffic?trafficTalkerInterface=eth0&trafficTalkerKey=eth0",
        ]}
      >
        <TrafficPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Top talker · eth0")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Expand table",
      }),
    );

    const sampleRows = screen
      .getAllByText("Recent traffic samples")[0]
      .closest("section");

    const sampleEth0Cell = within(sampleRows as HTMLElement).getAllByText(
      "eth0",
    )[0];

    await user.click(sampleEth0Cell);

    expect(
      await screen.findByText("Traffic sample · eth0"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficTalkerInterface",
    );

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "trafficTalkerKey",
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "trafficSampleId=1",
    );
  });

  it("creates a capture export request from the top talker drawer", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 40_000_000,
      total_bytes_tx: 70_000_000,
      total_bytes: 110_000_000,
      interface_count: 1,
      top_talker: null,
    });

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
      window_minutes: 60,
      items: [
        {
          interface_name: "eth0",
          entity_type: "interface",
          entity_key: "eth0",
          device_ip_address: "192.168.1.20",
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

    vi.mocked(api.getTrafficSamples).mockResolvedValue([]);

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

    await user.click(
      await screen.findByRole("button", {
        name: "Inspect top talker eth0",
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Create capture export",
      }),
    );

    expect(api.createCaptureExportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.20",
        window_minutes: 60,
      }),
    );

    expect(
      await screen.findByText(
        "Capture export request created. Use this as a handoff point for external packet inspection tools.",
      ),
    ).toBeInTheDocument();
  });

  it("opens device details from the traffic sample drawer", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 20_000_000,
      total_bytes_tx: 30_000_000,
      total_bytes: 50_000_000,
      interface_count: 1,
      top_talker: {
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.22",
        mac_address: "00:11:22:33:44:55",
        latest_bytes_rx: 8_000_000,
        latest_bytes_tx: 10_000_000,
        earliest_bytes_rx: 4_000_000,
        earliest_bytes_tx: 5_000_000,
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
          device_ip_address: "192.168.1.22",
          mac_address: "00:11:22:33:44:55",
          latest_bytes_rx: 8_000_000,
          latest_bytes_tx: 10_000_000,
          earliest_bytes_rx: 4_000_000,
          earliest_bytes_tx: 5_000_000,
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
        device_ip_address: "192.168.1.22",
        mac_address: "00:11:22:33:44:55",
        bytes_rx: 8_000_000,
        bytes_tx: 10_000_000,
        packets_rx: 1000,
        packets_tx: 1200,
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
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /expand table/i,
      }),
    );

    const sampleSection = screen
      .getAllByText("Recent traffic samples")[0]
      .closest("section");

    await user.click(
      within(sampleSection as HTMLElement).getAllByText("eth0")[0],
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Open device details",
      }),
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "/devices?",
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceIp=192.168.1.22",
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceMac=00%3A11%3A22%3A33%3A44%3A55",
    );
  });

  it("creates a capture export request from the traffic sample drawer", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 40_000_000,
      total_bytes_tx: 70_000_000,
      total_bytes: 110_000_000,
      interface_count: 1,
      top_talker: null,
    });

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
      window_minutes: 60,
      items: [],
    });

    vi.mocked(api.getTrafficSamples).mockResolvedValue([
      {
        id: 2,
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.20",
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

    await user.click(
      await screen.findByRole("button", {
        name: "Expand table",
      }),
    );

    const inspectLabel = await screen.findByText("Inspect");
    const sampleRow = inspectLabel.closest("tr");

    expect(sampleRow).not.toBeNull();

    await user.click(sampleRow!);

    await user.click(
      await screen.findByRole("button", {
        name: "Create capture export",
      }),
    );

    expect(api.createCaptureExportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "traffic_sample",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.20",
        window_minutes: 60,
      }),
    );

    expect(
      await screen.findByText(
        "Capture export request created. Use this as a handoff point for external packet inspection tools.",
      ),
    ).toBeInTheDocument();
  });

  it("renders capture export request history", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getTrafficSummary).mockResolvedValue({
      window_minutes: 60,
      total_bytes_rx: 40_000_000,
      total_bytes_tx: 70_000_000,
      total_bytes: 110_000_000,
      interface_count: 1,
      top_talker: null,
    });

    vi.mocked(api.getTrafficTopTalkers).mockResolvedValue({
      window_minutes: 60,
      items: [],
    });

    vi.mocked(api.getTrafficSamples).mockResolvedValue([]);

    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "High traffic movement observed from top talker drawer",
        status: "requested",
        capture_reference: null,
        created_at: new Date().toISOString(),
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

    expect(
      await screen.findByText("Capture export requests"),
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", {
        name: "Show capture requests",
      }),
    );

    expect(
      screen.getAllByText("traffic top talker").length,
    ).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("192.168.1.20")).toBeInTheDocument();
    expect(screen.getAllByText("Requested").length).toBeGreaterThanOrEqual(1);
    expect(
      await screen.findByText("Metadata handoff created"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "High traffic movement observed from top talker drawer",
      ),
    ).toBeInTheDocument();
  });

  it("shows capture lifecycle actions for requested export requests", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "requested",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: null,
        started_at: null,
        completed_at: null,
        failed_at: null,
        cancelled_at: null,
        failure_reason: null,
        duration_seconds: null,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(screen.getAllByText("Requested").length).toBeGreaterThanOrEqual(1);
    expect(
      await screen.findByText("Metadata handoff created"),
    ).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", {
        name: /^queue$/i,
      }),
    );

    expect(api.queueCaptureExportRequest).toHaveBeenCalledWith(1);
  });

  it("confirms before deleting a capture export request from history", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: "data/captures/capture-1-20260429T123000Z.pcap",
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: "capture-1-20260429T123000Z.pcap",
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /^delete$/i,
      }),
    );

    expect(api.deleteCaptureExportRequest).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Delete capture request?"),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("data/captures/capture-1-20260429T123000Z.pcap"),
    ).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", {
        name: /delete capture request/i,
      }),
    );

    expect(api.deleteCaptureExportRequest).toHaveBeenCalledWith(1);
  });

  it("cancels capture export request deletion confirmation", async () => {
    vi.mocked(api.deleteCaptureExportRequest).mockClear();

    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "interface",
        entity_key: "eth0",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /^delete$/i,
      }),
    );

    expect(
      await screen.findByText("Delete capture request?"),
    ).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", {
        name: /^cancel$/i,
      }),
    );

    expect(
      screen.queryByText("Delete capture request?"),
    ).not.toBeInTheDocument();
    expect(api.deleteCaptureExportRequest).not.toHaveBeenCalled();
  });

  it("opens a capture export request detail drawer from history", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: "data/captures/capture-1-20260429T123000Z.pcap",
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: "capture-1-20260429T123000Z.pcap",
        file_size_bytes: 1024,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /inspect/i,
      }),
    );

    expect(await screen.findByText("Capture request · #1")).toBeInTheDocument();
    expect(await screen.findByText("Failure reason")).toBeInTheDocument();
    expect(
      screen.getAllByText("tcpdump is not available").length,
    ).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Troubleshooting hint")).toBeInTheDocument();
    expect(await screen.findByText(/install tcpdump/i)).toBeInTheDocument();
    expect(
      await screen.findByText("data/captures/capture-1-20260429T123000Z.pcap"),
    ).toBeInTheDocument();
  });

  it("opens delete confirmation from the capture detail drawer", async () => {
    vi.mocked(api.deleteCaptureExportRequest).mockClear();

    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /inspect/i,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /delete request/i,
      }),
    );

    expect(
      await screen.findByText("Delete capture request?"),
    ).toBeInTheDocument();
    expect(api.deleteCaptureExportRequest).not.toHaveBeenCalled();
  });

  it("opens a capture detail drawer from query params", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: "data/captures/capture-1-20260429T123000Z.pcap",
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: "capture-1-20260429T123000Z.pcap",
        file_size_bytes: 1024,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/traffic?captureRequestId=1"]}>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Capture request · #1")).toBeInTheDocument();

    expect(await screen.findByText("Failure reason")).toBeInTheDocument();
  });

  it("clears capture request query params when the drawer closes", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Capture this top talker",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/traffic?captureRequestId=1"]}>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Capture request · #1")).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", {
        name: /close/i,
      }),
    );

    expect(screen.queryByText("Capture request · #1")).not.toBeInTheDocument();
  });

  it("filters capture export request history by status and search", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Phone capture",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
      {
        id: 2,
        source: "traffic_sample",
        interface_name: "wlan0",
        entity_type: "interface",
        entity_key: "wlan0",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Completed wireless capture",
        status: "completed",
        capture_reference: "data/captures/capture-2-20260429T123000Z.pcap",
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        failed_at: null,
        cancelled_at: null,
        failure_reason: null,
        duration_seconds: 30,
        output_filename: "capture-2-20260429T123000Z.pcap",
        file_size_bytes: 1024,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(await screen.findByText("192.168.1.20")).toBeInTheDocument();
    expect(screen.getAllByText("wlan0").length).toBeGreaterThanOrEqual(1);

    await userEvent.selectOptions(
      screen.getByLabelText(/capture status filter/i),
      "completed",
    );

    expect(screen.queryByText("192.168.1.20")).not.toBeInTheDocument();
    expect(screen.getAllByText("wlan0").length).toBeGreaterThanOrEqual(1);

    await userEvent.type(screen.getByLabelText(/capture search/i), "wireless");

    expect(screen.getAllByText("wlan0").length).toBeGreaterThanOrEqual(1);

    await userEvent.clear(screen.getByLabelText(/capture search/i));
    await userEvent.type(screen.getByLabelText(/capture search/i), "phone");

    expect(screen.queryByText("192.168.1.20")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Completed wireless capture"),
    ).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText(/capture status filter/i),
      "",
    );

    expect(await screen.findByText("192.168.1.20")).toBeInTheDocument();
    expect(
      screen.queryByText("Completed wireless capture"),
    ).not.toBeInTheDocument();
  });

  it("filters capture export request history from status summary chips", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Failed phone capture",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
      {
        id: 2,
        source: "traffic_sample",
        interface_name: "wlan0",
        entity_type: "interface",
        entity_key: "wlan0",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Completed wireless capture",
        status: "completed",
        capture_reference: "data/captures/capture-2-20260429T123000Z.pcap",
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        failed_at: null,
        cancelled_at: null,
        failure_reason: null,
        duration_seconds: 30,
        output_filename: "capture-2-20260429T123000Z.pcap",
        file_size_bytes: 1024,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(await screen.findByText("192.168.1.20")).toBeInTheDocument();
    expect(screen.getByText("Completed wireless capture")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /failed · 1/i,
      }),
    );

    expect(screen.getByText("192.168.1.20")).toBeInTheDocument();
    expect(
      screen.queryByText("Completed wireless capture"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /all · 2/i,
      }),
    );

    expect(screen.getByText("192.168.1.20")).toBeInTheDocument();
    expect(screen.getByText("Completed wireless capture")).toBeInTheDocument();
  });

  it("toggles compact capture export request history table", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "eth0",
        entity_type: "device",
        entity_key: "192.168.1.20",
        device_ip_address: "192.168.1.20",
        mac_address: null,
        window_minutes: 60,
        note: "Phone capture",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "tcpdump is not available",
        duration_seconds: 30,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(await screen.findByText("Phone capture")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /note/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /lifecycle/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /compact table/i,
      }),
    );

    expect(screen.queryByText("Phone capture")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /note/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /lifecycle/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByText("tcpdump is not available")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /compact table/i,
      }),
    );

    expect(await screen.findByText("Phone capture")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /note/i }),
    ).toBeInTheDocument();
  });

  it("shows troubleshooting guidance when capture execution is disabled", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 1,
        source: "traffic_top_talker",
        interface_name: "wlo1",
        entity_type: "interface",
        entity_key: "wlo1",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Capture export requested from traffic top talker drawer",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "capture execution is not enabled",
        duration_seconds: null,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/traffic?captureRequestId=1"]}>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Capture request · #1")).toBeInTheDocument();
    expect(await screen.findByText("Troubleshooting hint")).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/CAPTURE_EXECUTION_ENABLED=true/i)).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      await screen.findByText(/CAPTURE_ALLOWED_INTERFACES/i),
    ).toBeInTheDocument();
  });

  it("shows troubleshooting guidance for stale recovered captures", async () => {
    vi.mocked(api.getCaptureExportRequests).mockResolvedValue([
      {
        id: 2,
        source: "traffic_top_talker",
        interface_name: "wlo1",
        entity_type: "interface",
        entity_key: "wlo1",
        device_ip_address: null,
        mac_address: null,
        window_minutes: 60,
        note: "Capture export requested from traffic top talker drawer",
        status: "failed",
        capture_reference: null,
        created_at: new Date().toISOString(),
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        failed_at: new Date().toISOString(),
        cancelled_at: null,
        failure_reason: "capture request was recovered after becoming stale",
        duration_seconds: null,
        output_filename: null,
        file_size_bytes: null,
      },
    ]);

    renderWithQueryClient(
      <MemoryRouter initialEntries={["/traffic?captureRequestId=2"]}>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Capture request · #2")).toBeInTheDocument();
    expect(await screen.findByText("Troubleshooting hint")).toBeInTheDocument();
    expect(
      await screen.findByText(/backend likely restarted/i),
    ).toBeInTheDocument();
  });

  it("shows capture readiness when execution is disabled", async () => {
    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(await screen.findByText("Capture readiness")).toBeInTheDocument();
    expect(
      await screen.findByText("Capture execution is disabled."),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/CAPTURE_EXECUTION_ENABLED=true/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("Execution · disabled")).toBeInTheDocument();
    expect(await screen.findByText("Interfaces · wlo1")).toBeInTheDocument();
  });

  it("refreshes capture readiness on request", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(await screen.findByText("Capture readiness")).toBeInTheDocument();

    const initialCallCount = vi.mocked(api.getCaptureReadiness).mock.calls
      .length;

    await user.click(
      screen.getByRole("button", {
        name: /refresh readiness/i,
      }),
    );

    await screen.findByText("Capture readiness");

    expect(
      vi.mocked(api.getCaptureReadiness).mock.calls.length,
    ).toBeGreaterThan(initialCallCount);
  });

  it("shows capture readiness when execution is ready", async () => {
    vi.mocked(api.getCaptureReadiness).mockResolvedValue({
      execution_enabled: true,
      can_execute: true,
      tcpdump_available: true,
      output_directory_ready: true,
      duration_bounds_valid: true,
      allowed_interfaces_valid: true,
      allowed_interfaces: ["wlo1"],
      output_dir: "data/captures",
      default_duration_seconds: 30,
      min_duration_seconds: 5,
      max_duration_seconds: 120,
      max_file_mb: 50,
      issues: [],
    });

    renderWithQueryClient(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: /show capture requests/i,
      }),
    );

    expect(
      await screen.findByText("Capture execution is ready"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(await screen.findByText("Execution · enabled")).toBeInTheDocument();
    expect(await screen.findByText("tcpdump · available")).toBeInTheDocument();
  });
});
