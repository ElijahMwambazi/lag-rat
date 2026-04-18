import {
  render,
  screen,
} from "@testing-library/react";
import AlertDetailDrawer from "../components/alerts/AlertDetailDrawer";
import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/incidentText", () => ({
  formatIncidentType: (value: string) => {
    if (value === "wifi") return "Wi-Fi";
    return "Web connectivity";
  },
  formatIncidentState: (value: string) =>
    value === "active" ? "Ongoing" : "Recovered",
  buildAlertHeadline: ({
    entityType,
    entityKey,
    message,
  }: {
    entityType: string;
    entityKey: string;
    message: string;
  }) => {
    if (
      entityType === "wifi" &&
      message
        .toLowerCase()
        .includes("wifi signal is weak")
    ) {
      return `Weak Wi-Fi signal in ${entityKey}`;
    }

    return "Web connectivity check failed";
  },
  buildAlertSubtext: ({
    entityType,
    entityKey,
  }: {
    entityType: string;
    entityKey: string;
    message: string;
  }) => ({
    targetLabel:
      entityType === "wifi"
        ? `Room: ${entityKey}`
        : "Target: https://example.com",
  }),
}));

describe("AlertDetailDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AlertDetailDrawer
        alert={null}
        open={false}
        onClose={() => {}}
        history={[]}
        onAcknowledge={() => {}}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders active unacknowledged alert details and acknowledge button", () => {
    render(
      <AlertDetailDrawer
        open
        onClose={() => {}}
        onAcknowledge={() => {}}
        alert={{
          id: 1,
          alert_type: "service_health",
          severity: "critical",
          entity_type: "internet_http",
          entity_key: "https://example.com",
          message:
            "internet_http check failed: timeout",
          is_active: true,
          created_at: "2026-04-11T10:00:00Z",
          resolved_at: null,
          acknowledged_at: null,
        }}
        history={[
          {
            id: 10,
            event_type: "opened",
            previous_value: null,
            new_value: "critical",
            created_at: "2026-04-11T10:00:00Z",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Web connectivity check failed",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Entity type"),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Web connectivity")
        .length,
    ).toBeGreaterThan(1);

    expect(
      screen.getByText("Status"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Target: https://example.com",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Message summary"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Technical message"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "internet_http check failed: timeout",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Acknowledge"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Copy target"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Copy message"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Timeline"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Opened"),
    ).toBeInTheDocument();
  });

  it("hides acknowledge button for acknowledged or resolved alerts", () => {
    render(
      <AlertDetailDrawer
        open
        onClose={() => {}}
        onAcknowledge={() => {}}
        alert={{
          id: 2,
          alert_type: "service_health",
          severity: "warning",
          entity_type: "internet_http",
          entity_key: "https://example.com",
          message: "recovered",
          is_active: false,
          created_at: "2026-04-11T10:00:00Z",
          resolved_at: "2026-04-11T10:10:00Z",
          acknowledged_at: "2026-04-11T10:05:00Z",
        }}
        history={[]}
      />,
    );

    expect(
      screen.queryByText("Acknowledge"),
    ).not.toBeInTheDocument();
  });

  it("renders wifi alert details with room-first wording", () => {
    vi.doUnmock("../utils/incidentText");

    render(
      <AlertDetailDrawer
        open
        onClose={() => {}}
        onAcknowledge={() => {}}
        alert={{
          id: 3,
          alert_type: "wifi_signal_weak",
          severity: "warning",
          entity_type: "wifi",
          entity_key: "office",
          message:
            "wifi signal is weak in office: -72 dBm",
          is_active: true,
          created_at: "2026-04-15T10:00:00Z",
          resolved_at: null,
          acknowledged_at: null,
        }}
        history={[]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /Weak Wi-Fi signal in office/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Room: office"),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Wi-Fi").length,
    ).toBeGreaterThan(0);
  });
});
