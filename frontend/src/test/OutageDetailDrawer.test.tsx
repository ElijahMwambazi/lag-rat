import {
  render,
  screen,
} from "@testing-library/react";
import OutageDetailDrawer from "../components/OutageDetailDrawer";
import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/incidentText", () => ({
  formatIncidentType: () => "Web connectivity",
  formatIncidentState: (value: string) =>
    value === "active" ? "Ongoing" : "Recovered",
}));

describe("OutageDetailDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <OutageDetailDrawer
        outage={null}
        open={false}
        onClose={() => {}}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders outage details when open", () => {
    render(
      <OutageDetailDrawer
        open
        onClose={() => {}}
        outage={{
          id: 1,
          outage_type: "internet_http",
          target: "https://example.com",
          started_at: "2026-04-11T10:00:00Z",
          ended_at: "2026-04-11T10:10:00Z",
          is_active: false,
          start_error: "error sending request",
          end_note: "Recovered after retry",
          duration_seconds: 600,
          status: "resolved",
        }}
      />,
    );

    expect(
      screen.getByText("Web connectivity"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Incident details"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("https://example.com"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recovered"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("error sending request"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recovered after retry"),
    ).toBeInTheDocument();
  });
});
