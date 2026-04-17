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
import ReportsPage from "../pages/ReportsPage";
import { renderWithQueryClient } from "./render";

function seedReportsSuccessState() {
  vi.mocked(
    api.getReportsSummary,
  ).mockResolvedValue({
    window_hours: 24,
    uptime_pct: 99.9,
    avg_latency_ms: 15,
    outage_count: 1,
    total_downtime_seconds: 120,
    dns_failure_count: 2,
    device_history_event_count: 1,
    active_alert_count: 1,
    active_critical_alert_count: 1,
    active_unacknowledged_alert_count: 1,
  });

  vi.mocked(
    api.getReportTrends,
  ).mockResolvedValue([
    {
      bucket_start: "2026-04-11T10:00:00Z",
      label: "10:00",
      outage_count: 1,
      dns_failure_count: 1,
      internet_http_failure_count: 1,
      internet_tcp_failure_count: 0,
    },
  ]);

  vi.mocked(
    api.getRecentReportAlertEvents,
  ).mockResolvedValue([
    {
      alert_id: 1,
      event_type: "opened",
      severity: "critical",
      entity_type: "internet_http",
      entity_key: "https://example.com",
      alert_type: "service_health",
      message:
        "internet_http check failed: timeout",
      previous_value: null,
      new_value: "critical",
      created_at: "2026-04-11T10:00:00Z",
    },
  ]);

  vi.mocked(
    api.getRecentReportDeviceEvents,
  ).mockResolvedValue([
    {
      device_ip_address: "192.168.1.20",
      event_type: "hostname_changed",
      previous_value: "old-host",
      new_value: "new-host",
      created_at: "2026-04-11T10:00:00Z",
    },
  ]);

  vi.mocked(
    api.getTopIncidentTargets,
  ).mockResolvedValue([
    {
      incident_type: "internet_http",
      target: "https://example.com",
      count: 2,
      active_count: 1,
      total_downtime_seconds: 120,
      latest_started_at: new Date().toISOString(),
    },
  ]);

  vi.mocked(api.getOutages).mockResolvedValue([
    {
      id: 1,
      outage_type: "internet_http",
      target: "https://example.com",
      started_at: new Date().toISOString(),
      ended_at: null,
      is_active: true,
      start_error: "error sending request",
      end_note: null,
      duration_seconds: 120,
      status: "active",
    },
  ]);

  vi.mocked(
    api.getReportsSnapshot,
  ).mockResolvedValue({
    generated_at: "2026-04-11T10:00:00Z",
    window_hours: 24,
    narrative_summary: "Test snapshot",
    summary: {},
    top_incident_targets: [],
    recent_alert_events: [],
    recent_device_events: [],
    outages: [],
  } as never);

  vi.mocked(
    api.getRecentReportAlertEvents,
  ).mockResolvedValue([
    {
      alert_id: 1,
      event_type: "opened",
      severity: "warning",
      entity_type: "wifi",
      entity_key: "office",
      alert_type: "wifi_signal_weak",
      message:
        "wifi signal is weak in office: -72 dBm",
      previous_value: null,
      new_value: "warning",
      created_at: "2026-04-11T10:00:00Z",
    },
  ]);
}

vi.mock("recharts", async () => {
  return await import("./mocks/recharts");
});

vi.mock(
  "../components/OutageDetailDrawer",
  () => ({
    default: ({
      open,
      outage,
    }: {
      open: boolean;
      outage?: { target?: string } | null;
    }) =>
      open ? (
        <div>
          Outage detail drawer
          {outage?.target
            ? `: ${outage.target}`
            : ""}
        </div>
      ) : null,
  }),
);

vi.mock("../components/DataTableCard", () => ({
  default: ({
    title,
    description,
    helperText,
    children,
  }: {
    title: string;
    description?: string;
    helperText?: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {helperText ? <p>{helperText}</p> : null}
      {children}
    </section>
  ),
}));

vi.mock("../utils/incidentText", () => ({
  buildAlertHeadline: () =>
    "Web connectivity check failed",
  buildAlertSubtext: () => ({
    targetLabel: "Target: https://example.com",
  }),
  formatAlertEventTransition: () =>
    "Alert recovered",
  formatIncidentState: (value: string) =>
    value === "active" ? "Ongoing" : "Recovered",
  formatIncidentType: () => "Web connectivity",
  summarizeOutageCause: () =>
    "Web probe request failed",
}));

vi.mock("../services/api", () => ({
  api: {
    getReportsSummary: vi.fn(),
    getReportTrends: vi.fn(),
    getRecentReportAlertEvents: vi.fn(),
    getRecentReportDeviceEvents: vi.fn(),
    getTopIncidentTargets: vi.fn(),
    getOutages: vi.fn(),
    getReportsSnapshot: vi.fn(),
  },
}));

import { api } from "../services/api";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows reports summary failure state", async () => {
    vi.mocked(
      api.getReportsSummary,
    ).mockRejectedValue(
      new Error("reports summary failed"),
    );
    vi.mocked(
      api.getReportTrends,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportAlertEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportDeviceEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getTopIncidentTargets,
    ).mockResolvedValue([]);
    vi.mocked(api.getOutages).mockResolvedValue(
      [],
    );

    renderWithQueryClient(<ReportsPage />);

    expect(
      await screen.findByText(
        "Reports summary request failed",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("reports summary failed"),
    ).toBeInTheDocument();
  });

  it("shows empty recent alert events state", async () => {
    vi.mocked(
      api.getReportsSummary,
    ).mockResolvedValue({
      window_hours: 24,
      uptime_pct: 99.9,
      avg_latency_ms: 15,
      outage_count: 0,
      total_downtime_seconds: 0,
      dns_failure_count: 0,
      device_history_event_count: 0,
      active_alert_count: 0,
      active_critical_alert_count: 0,
      active_unacknowledged_alert_count: 0,
    });
    vi.mocked(
      api.getReportTrends,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportAlertEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getRecentReportDeviceEvents,
    ).mockResolvedValue([]);
    vi.mocked(
      api.getTopIncidentTargets,
    ).mockResolvedValue([]);
    vi.mocked(api.getOutages).mockResolvedValue(
      [],
    );

    renderWithQueryClient(<ReportsPage />);

    expect(
      await screen.findByText(
        "No recent alert events were recorded in this window.",
      ),
    ).toBeInTheDocument();
  });
});

it("refetches reports queries when the window changes to 7d", async () => {
  const user = userEvent.setup();
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  expect(
    await screen.findByDisplayValue("Last 24h"),
  ).toBeInTheDocument();

  await user.selectOptions(
    screen.getAllByRole("combobox")[0],
    "168",
  );

  expect(
    api.getReportsSummary,
  ).toHaveBeenCalledWith(168);
  expect(
    api.getReportTrends,
  ).toHaveBeenCalledWith(168);
  expect(
    api.getRecentReportAlertEvents,
  ).toHaveBeenCalledWith(168);
  expect(
    api.getRecentReportDeviceEvents,
  ).toHaveBeenCalledWith(168);
  expect(
    api.getTopIncidentTargets,
  ).toHaveBeenCalledWith(168);
});

it("renders recent alert events as a fixed inspection panel", async () => {
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  expect(
    await screen.findByText(
      "Recent alert events",
    ),
  ).toBeInTheDocument();

  expect(
    screen.getByText(
      "Web connectivity check failed",
    ),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: "Show all",
    }),
  ).not.toBeInTheDocument();
});

it("renders recent device changes as a fixed inspection panel", async () => {
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  expect(
    await screen.findByText(
      "Recent device changes",
    ),
  ).toBeInTheDocument();

  expect(
    screen.getByText("Hostname changed"),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("button", {
      name: "Show all",
    }),
  ).not.toBeInTheDocument();
});

it("renders top incident targets as a fixed inspection panel", async () => {
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  expect(
    await screen.findByText(
      "Top incident targets",
    ),
  ).toBeInTheDocument();

  expect(
    screen.getByText("2 incidents"),
  ).toBeInTheDocument();
});

it("opens outage detail drawer when an outage row is clicked", async () => {
  const user = userEvent.setup();
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  await user.click(
    (
      await screen.findAllByRole("button", {
        name: "Show explorer",
      })
    )[0],
  );

  const cells = await screen.findAllByText(
    "https://example.com",
  );
  await user.click(cells[cells.length - 1]);

  expect(
    await screen.findByText(/Incident details/i),
  ).toBeInTheDocument();
});

it("exports JSON using the selected window", async () => {
  const user = userEvent.setup();
  seedReportsSuccessState();

  const originalCreateObjectURL =
    URL.createObjectURL;
  const originalRevokeObjectURL =
    URL.revokeObjectURL;

  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();

  try {
    renderWithQueryClient(<ReportsPage />);

    await screen.findByText("Reports");

    await user.selectOptions(
      screen.getAllByRole("combobox")[0],
      "168",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Export JSON",
      }),
    );

    expect(
      api.getReportsSnapshot,
    ).toHaveBeenCalledWith(168);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

it("passes search and filter params to outages query", async () => {
  const user = userEvent.setup();
  seedReportsSuccessState();

  renderWithQueryClient(<ReportsPage />);

  await user.click(
    (
      await screen.findAllByRole("button", {
        name: "Show explorer",
      })
    )[0],
  );

  await screen.findByPlaceholderText(
    "Search target, type, status, error...",
  );

  await user.type(
    screen.getByPlaceholderText(
      "Search target, type, status, error...",
    ),
    "example",
  );

  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[1], "dns");
  await user.selectOptions(
    selects[2],
    "resolved",
  );

  await waitFor(() => {
    expect(
      api.getOutages,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outage_type: "dns",
        status: "resolved",
        search: "example",
      }),
    );
  });
});
