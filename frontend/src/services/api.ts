export type HealthCurrentResponse = {
  router_ip: string;
  router_reachable: boolean;
  internet_reachable: boolean;
  dns_healthy: boolean;
  checked_at: string;
};

export type TimeseriesPoint = {
  timestamp: string;
  value: number;
};

export type SummaryResponse = {
  uptime_pct_24h: number;
  avg_latency_ms_24h: number;
  outage_count_24h: number;
};

export type Device = {
  id: number;
  ip_address: string;
  mac_address?: string | null;
  hostname?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
};

export type Outage = {
  id: number;
  outage_type: string;
  target: string;
  started_at: string;
  ended_at?: string | null;
  is_active: boolean;
  start_error?: string | null;
  end_note?: string | null;
};

const API_BASE = "http://127.0.0.1:8080";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getCurrentHealth: () => getJson<HealthCurrentResponse>("/api/health/current"),
  getHealthHistory: () => getJson<TimeseriesPoint[]>("/api/health/history?minutes=60"),
  getDnsHistory: () => getJson<TimeseriesPoint[]>("/api/dns/history?minutes=60"),
  getSummary: () => getJson<SummaryResponse>("/api/stats/summary"),
  getDevices: () => getJson<Device[]>("/api/devices"),
  getOutages: () => getJson<Outage[]>("/api/outages"),
};
