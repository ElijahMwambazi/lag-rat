import {
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import OverviewPage from "../pages/OverviewPage";
import MetricsPage from "../pages/MetricsPage";
import DevicesPage from "../pages/DevicesPage";
import ReportsPage from "../pages/ReportsPage";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/metrics", label: "Metrics" },
  { to: "/devices", label: "Devices" },
  { to: "/reports", label: "Reports" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              Lag Rat
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Home network observability dashboard
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1 sm:flex-nowrap sm:overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-zinc-100 text-zinc-900 shadow-sm ring-1 ring-zinc-200/70"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Routes>
          <Route
            path="/"
            element={<OverviewPage />}
          />
          <Route
            path="/metrics"
            element={<MetricsPage />}
          />
          <Route
            path="/devices"
            element={<DevicesPage />}
          />
          <Route
            path="/reports"
            element={<ReportsPage />}
          />
        </Routes>
      </main>
    </div>
  );
}
