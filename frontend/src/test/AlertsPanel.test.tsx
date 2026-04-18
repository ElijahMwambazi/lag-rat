import {
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import AlertsPanel from "../components/alerts/AlertsPanel";
import { renderWithQueryClient } from "./render";

vi.mock(
  "../components/AlertDetailDrawer",
  () => ({
    default: () => <div>Alert detail drawer</div>,
  }),
);

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

vi.mock("../services/api", () => ({
  api: {
    getAlerts: vi.fn(),
    getAlertHistory: vi.fn(),
    acknowledgeAlert: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("AlertsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", async () => {
    vi.mocked(api.getAlerts).mockImplementation(
      () => new Promise(() => {}),
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    expect(
      await screen.findByText(
        "Loading alerts...",
      ),
    ).toBeInTheDocument();
  });

  it("renders error state", async () => {
    vi.mocked(api.getAlerts).mockRejectedValue(
      new Error("alerts failed"),
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    expect(
      await screen.findByText("alerts failed"),
    ).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(api.getAlerts).mockResolvedValue(
      [],
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    expect(
      await screen.findByText(
        "No alerts match the current filters.",
      ),
    ).toBeInTheDocument();
  });

  it("renders humanized alert card content", async () => {
    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 1,
        alert_type: "service_health",
        severity: "critical",
        entity_type: "internet_http",
        entity_key: "https://example.com",
        message:
          "internet_http check failed: timeout",
        is_active: true,
        created_at: "2026-04-11T11:58:00Z",
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    expect(
      await screen.findByText(
        "Web connectivity check failed",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Target: https://example.com",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Ongoing"),
    ).toBeInTheDocument();
  });

  it("applies active-critical focus mode", async () => {
    vi.mocked(api.getAlerts).mockResolvedValue(
      [],
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(
      <AlertsPanel focusMode="active-critical" />,
    );

    await waitFor(() => {
      expect(
        api.getAlerts,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          severity: "critical",
        }),
      );
    });
  });

  it("opens detail drawer when an alert is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getAlerts).mockResolvedValue([
      {
        id: 1,
        alert_type: "service_health",
        severity: "critical",
        entity_type: "internet_http",
        entity_key: "https://example.com",
        message:
          "internet_http check failed: timeout",
        is_active: true,
        created_at: "2026-04-11T11:58:00Z",
        resolved_at: null,
        acknowledged_at: null,
      },
    ]);
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    const card = await screen.findByRole(
      "button",
      {
        name: /web connectivity check failed/i,
      },
    );

    await user.click(card);

    expect(
      await screen.findByText(
        "Alert detail drawer",
      ),
    ).toBeInTheDocument();
  });

  it("passes wifi entity filter to alerts query", async () => {
    const user = userEvent.setup();

    vi.mocked(api.getAlerts).mockResolvedValue(
      [],
    );
    vi.mocked(
      api.getAlertHistory,
    ).mockResolvedValue([]);
    vi.mocked(
      api.acknowledgeAlert,
    ).mockResolvedValue({} as never);

    renderWithQueryClient(<AlertsPanel />);

    const selects =
      await screen.findAllByRole("combobox");
    await user.selectOptions(selects[2], "wifi");

    await waitFor(() => {
      expect(
        api.getAlerts,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entity_type: "wifi",
        }),
      );

      expect(
        screen.getByRole("option", {
          name: "wifi",
        }),
      ).toBeInTheDocument();
    });
  });
});
