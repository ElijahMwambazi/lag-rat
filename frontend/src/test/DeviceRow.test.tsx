import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeviceRow from "../components/devices/DeviceRow";
import { describe, it, expect, vi } from "vitest";

describe("DeviceRow", () => {
  const device = {
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

  it("renders device row content", () => {
    render(
      <table>
        <tbody>
          <DeviceRow
            device={device}
            editingId={null}
            isSaving={false}
            label=""
            notes=""
            onStartEdit={() => {}}
            onCancelEdit={() => {}}
            onSave={() => {}}
            onLabelChange={() => {}}
            onNotesChange={() => {}}
            onOpenDetails={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(
      screen.getByText("Office laptop"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Main machine"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("192.168.1.10"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Edit label"),
    ).toBeInTheDocument();
  });

  it("opens edit mode when editingId matches device id", () => {
    render(
      <table>
        <tbody>
          <DeviceRow
            device={device}
            editingId={1}
            isSaving={false}
            label="Office laptop"
            notes="Main machine"
            onStartEdit={() => {}}
            onCancelEdit={() => {}}
            onSave={() => {}}
            onLabelChange={() => {}}
            onNotesChange={() => {}}
            onOpenDetails={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(
      screen.getByPlaceholderText("Device label"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Notes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Save"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cancel"),
    ).toBeInTheDocument();
  });

  it("calls onStartEdit when edit label is clicked", async () => {
    const user = userEvent.setup();
    const onStartEdit = vi.fn();

    render(
      <table>
        <tbody>
          <DeviceRow
            device={device}
            editingId={null}
            isSaving={false}
            label=""
            notes=""
            onStartEdit={onStartEdit}
            onCancelEdit={() => {}}
            onSave={() => {}}
            onLabelChange={() => {}}
            onNotesChange={() => {}}
            onOpenDetails={() => {}}
          />
        </tbody>
      </table>,
    );

    await user.click(
      screen.getByText("Edit label"),
    );

    expect(onStartEdit).toHaveBeenCalledWith(
      device,
    );
  });

  it("calls onOpenDetails when row is clicked", async () => {
    const user = userEvent.setup();
    const onOpenDetails = vi.fn();

    render(
      <table>
        <tbody>
          <DeviceRow
            device={device}
            editingId={null}
            isSaving={false}
            label=""
            notes=""
            onStartEdit={() => {}}
            onCancelEdit={() => {}}
            onSave={() => {}}
            onLabelChange={() => {}}
            onNotesChange={() => {}}
            onOpenDetails={onOpenDetails}
          />
        </tbody>
      </table>,
    );

    await user.click(
      screen.getByText("Office laptop"),
    );

    expect(onOpenDetails).toHaveBeenCalledWith(
      device,
    );
  });
});
