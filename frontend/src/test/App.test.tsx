import {
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../app/App";
import { describe, expect, it, vi } from "vitest";

vi.mock("../pages/OverviewPage", () => ({
  default: () => <div>Overview page</div>,
}));

vi.mock("../pages/MetricsPage", () => ({
  default: () => <div>Metrics page</div>,
}));

vi.mock("../pages/DevicesPage", () => ({
  default: () => <div>Devices page</div>,
}));

vi.mock("../pages/ReportsPage", () => ({
  default: () => <div>Reports page</div>,
}));

describe("App", () => {
  it("renders shell and overview route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Lag Rat"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Home network observability dashboard",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Overview page"),
    ).toBeInTheDocument();
  });

  it("renders reports route", () => {
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Reports page"),
    ).toBeInTheDocument();
  });
});
