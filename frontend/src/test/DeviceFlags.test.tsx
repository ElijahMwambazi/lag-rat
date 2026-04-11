import {
  render,
  screen,
} from "@testing-library/react";
import DeviceFlags from "../components/devices/DeviceFlags";
import { describe, it, expect } from "vitest";

describe("DeviceFlags", () => {
  it("renders all matching flags", () => {
    render(
      <DeviceFlags
        device={{
          id: 1,
          ip_address: "192.168.1.10",
          mac_address: "aa:bb:cc:dd:ee:ff",
          hostname: "laptop",
          display_name: "Office laptop",
          label: "Office laptop",
          notes: null,
          first_seen: null,
          last_seen: null,
          is_recent: true,
          is_gateway: true,
          is_this_device: true,
          is_known: true,
          confidence: "high",
        }}
      />,
    );

    expect(
      screen.getByText("High confidence"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gateway"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This Device"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Known"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recent"),
    ).toBeInTheDocument();
  });

  it("renders low confidence when appropriate", () => {
    render(
      <DeviceFlags
        device={{
          id: 2,
          ip_address: "192.168.1.20",
          mac_address: null,
          hostname: null,
          display_name: "Unknown device",
          label: null,
          notes: null,
          first_seen: null,
          last_seen: null,
          is_recent: false,
          is_gateway: false,
          is_this_device: false,
          is_known: false,
          confidence: "low",
        }}
      />,
    );

    expect(
      screen.getByText("Low confidence"),
    ).toBeInTheDocument();
  });
});
