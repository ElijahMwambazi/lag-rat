import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeviceDetailDrawer from "../components/devices/DeviceDetailDrawer";
import { renderWithQueryClient } from "./render";

vi.mock("../services/api", () => ({
  api: {
    getDeviceHistory: vi.fn(),
  },
}));

import { api } from "../services/api";

const baseDevice = {
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
};

describe("DeviceDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithQueryClient(
      <DeviceDetailDrawer
        device={null}
        open={false}
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders device details when open", async () => {
    vi.mocked(api.getDeviceHistory).mockResolvedValue([]);

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={baseDevice}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Office laptop",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Device details")).toBeInTheDocument();
    expect(screen.getByText("Main machine")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("aa:bb:cc:dd:ee:ff")).toBeInTheDocument();

    expect(await screen.findByText("No history yet.")).toBeInTheDocument();

    expect(screen.getByText("Edit label")).toBeInTheDocument();
    expect(screen.getByText("Copy IP")).toBeInTheDocument();
    expect(screen.getByText("Copy MAC")).toBeInTheDocument();

    expect(screen.getByText("Capture device traffic")).toBeInTheDocument();

    expect(
      screen.getByText(
        /opens the Traffic page capture drawer so you can queue, inspect, cancel, or delete the request/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows add label when device is not known", async () => {
    vi.mocked(api.getDeviceHistory).mockResolvedValue([]);

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={{
          ...baseDevice,
          is_known: false,
          label: null,
        }}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(screen.getByText("Add label")).toBeInTheDocument();

    expect(await screen.findByText("No history yet.")).toBeInTheDocument();
  });

  it("renders history loading state", async () => {
    vi.mocked(api.getDeviceHistory).mockImplementation(
      () => new Promise(() => {}),
    );

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={baseDevice}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(await screen.findByText("Loading history...")).toBeInTheDocument();
  });

  it("renders history error state", async () => {
    vi.mocked(api.getDeviceHistory).mockRejectedValue(
      new Error("history failed"),
    );

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={baseDevice}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(
      await screen.findByText("Could not load history."),
    ).toBeInTheDocument();
  });

  it("renders device history items", async () => {
    vi.mocked(api.getDeviceHistory).mockResolvedValue([
      {
        id: 1,
        event_type: "first_seen",
        previous_value: null,
        new_value: "Office laptop",
        created_at: "2026-04-11T10:00:00Z",
      },
      {
        id: 2,
        event_type: "notes_changed",
        previous_value: "Old note",
        new_value: "New note",
        created_at: "2026-04-11T11:00:00Z",
      },
    ]);

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={baseDevice}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={() => {}}
      />,
    );

    expect(await screen.findByText("First seen")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Office laptop",
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Notes updated")).toBeInTheDocument();

    expect(await screen.findByText("Old note → New note")).toBeInTheDocument();
  });

  it("calls capture handler from the device capture action", async () => {
    vi.mocked(api.getDeviceHistory).mockResolvedValue([]);
    const onCaptureTraffic = vi.fn();

    renderWithQueryClient(
      <DeviceDetailDrawer
        device={baseDevice}
        open
        onClose={() => {}}
        onEdit={() => {}}
        onCaptureTraffic={onCaptureTraffic}
      />,
    );

    screen.getByText("Capture device traffic").click();

    expect(onCaptureTraffic).toHaveBeenCalledWith(baseDevice);
  });
});
