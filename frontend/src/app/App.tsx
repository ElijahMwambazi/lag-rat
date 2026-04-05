import { NavLink, Route, Routes } from "react-router-dom";
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
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div><h1 className="text-xl font-semibold">Lag Rat</h1><p className="text-sm text-zinc-400">Home network observability dashboard</p></div>
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>
    </div>
  );
}
