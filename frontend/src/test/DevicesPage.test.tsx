import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DevicesPage from "../pages/DevicesPage";
import { renderWithQueryClient } from "./render";
import { api } from "../services/api";

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
    getDevices: vi.fn(),
    saveKnownDevice: vi.fn(),
    createCaptureExportRequest: vi.fn(),
  },
}));

vi.mock("../components/devices/DeviceRow", () => ({
  default: ({
    device,
    onOpenDetails,
  }: {
    device: {
      display_name: string;
    };
    onOpenDetails: (device: unknown) => void;
  }) => (
    <tr>
      <td>{device.display_name}</td>
      <td>
        <button type="button" onClick={() => onOpenDetails(device)}>
          {`Open ${device.display_name}`}
        </button>
      </td>
    </tr>
  ),
}));

vi.mock("../components/devices/DeviceDetailDrawer", () => ({
  default: ({
    device,
    open,
    onClose,
    onCaptureTraffic,
  }: {
    device: {
      display_name: string;
    } | null;
    open: boolean;
    onClose: () => void;
    onCaptureTraffic: (device: unknown) => void;
  }) =>
    open && device ? (
      <div>
        <div>{`Device drawer · ${device.display_name}`}</div>
        <button type="button" onClick={onClose}>
          Close device drawer
        </button>
        <button type="button" onClick={() => onCaptureTraffic(device)}>
          Capture device traffic
        </button>
      </div>
    ) : null,
}));

const devices = [
  {
    id: 1,
    ip_address: "192.168.1.10",
    mac_address: "aa:bb:cc:dd:ee:ff",
    hostname: "office-laptop",
    display_name: "Office laptop",
    label: "Office laptop",
    notes: "Main machine",
    first_seen: "2026-04-11T10:00:00Z",
    last_seen: "2026-04-11T11:00:00Z",
    is_recent: true,
    is_gateway: false,
    is_this_device: false,
    is_known: true,
    confidence: "high" as const,
  },
  {
    id: 2,
    ip_address: "192.168.1.22",
    mac_address: "00:11:22:33:44:55",
    hostname: "tv",
    display_name: "Living room TV",
    label: "Living room TV",
    notes: "",
    first_seen: "2026-04-11T10:00:00Z",
    last_seen: "2026-04-11T11:00:00Z",
    is_recent: true,
    is_gateway: false,
    is_this_device: false,
    is_known: true,
    confidence: "high" as const,
  },
];

describe("DevicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDevices).mockResolvedValue(devices);
    vi.mocked(api.saveKnownDevice).mockResolvedValue({
      ip_address: "192.168.1.10",
      mac_address: "aa:bb:cc:dd:ee:ff",
      label: "Office laptop",
      notes: "Main machine",
      id: 0,
      created_at: "",
      updated_at: "",
    });
    vi.mocked(api.createCaptureExportRequest).mockResolvedValue({
      id: 42,
      source: "device_detail",
      interface_name: "wlo1",
      entity_type: "device",
      entity_key: "192.168.1.10",
      device_ip_address: "192.168.1.10",
      mac_address: "aa:bb:cc:dd:ee:ff",
      window_minutes: 60,
      note: "Capture traffic related to this device",
      status: "requested",
      capture_reference: null,
      created_at: new Date().toISOString(),
    });
  });

  it("opens the matching device drawer from query params", async () => {
    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={[
          "/devices?deviceIp=192.168.1.10&deviceMac=aa%3Abb%3Acc%3Add%3Aee%3Aff",
        ]}
      >
        <DevicesPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Device drawer · Office laptop"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceIp=192.168.1.10",
    );

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "deviceMac=aa%3Abb%3Acc%3Add%3Aee%3Aff",
    );
  });

  it("clears device query params when the drawer closes", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={[
          "/devices?deviceIp=192.168.1.10&deviceMac=aa%3Abb%3Acc%3Add%3Aee%3Aff",
        ]}
      >
        <DevicesPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Close device drawer",
      }),
    );

    expect(
      screen.queryByText("Device drawer · Office laptop"),
    ).not.toBeInTheDocument();

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "deviceIp",
    );

    expect(screen.getByTestId("location-search")).not.toHaveTextContent(
      "deviceMac",
    );
  });

  it("creates a device capture request and opens the traffic capture drawer", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
        initialEntries={["/devices?deviceIp=192.168.1.10"]}
      >
        <DevicesPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Device drawer · Office laptop"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Capture device traffic",
      }),
    );

    expect(api.createCaptureExportRequest).toHaveBeenCalledWith({
      source: "device_detail",
      interface_name: "wlo1",
      entity_type: "device",
      entity_key: "192.168.1.10",
      device_ip_address: "192.168.1.10",
      mac_address: "aa:bb:cc:dd:ee:ff",
      window_minutes: 60,
      note: "Capture traffic related to this device",
    });

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "/traffic?captureRequestId=42",
    );
  });
});
