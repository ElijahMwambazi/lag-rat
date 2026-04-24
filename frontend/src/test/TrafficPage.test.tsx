import { MemoryRouter, useLocation } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
