export type SummaryResponse = {
  uptime_pct_24h: number;
  avg_latency_ms_24h: number;
  outage_count_24h: number;
};

export type TimeseriesPoint = {
  timestamp: string;
  value: number;
};

export type Alert = {
  id: number;
  alert_type: string;
  severity: string;
  entity_type: string;
  entity_key: string;
  message: string;
  is_active: boolean;
  created_at: string;
  resolved_at?: string | null;
};

export type ServiceStatus = {
  is_healthy: boolean;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  latest_latency_ms?: number | null;
  latest_error_message?: string | null;
  active_outage: boolean;
};

export type DnsStatus = {
  is_healthy: boolean;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  latest_response_time_ms?: number | null;
  latest_error_message?: string | null;
  active_outage: boolean;
};

export type StatusOverviewResponse = {
  checked_at: string;
  router: ServiceStatus;
  internet: ServiceStatus;
  internet_tcp: ServiceStatus;
  internet_http: ServiceStatus;
  dns: DnsStatus;
  devices: {
    active_count_24h: number;
    most_recent_seen_at?: string | null;
  };
  outages: {
    active_count: number;
    last_24h_count: number;
  };
};

export type Device = {
  id: number;
  ip_address: string;
  mac_address?: string | null;
  hostname?: string | null;
  display_name: string;
  label?: string | null;
  notes?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  is_recent: boolean;
  is_gateway: boolean;
  is_known: boolean;
  confidence: "high" | "medium" | "low";
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
  duration_seconds?: number | null;
  status: string;
};

export type SaveKnownDeviceRequest = {
  ip_address?: string | null;
  mac_address?: string | null;
  label: string;
  notes?: string | null;
};

export type DeviceHistoryItem = {
  id: number;
  event_type: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

const API_BASE = "http://127.0.0.1:8080";

async function getJson<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path}`,
  );
  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}

async function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<TResponse>;
}

export const api = {
  getStatusOverview: () =>
    getJson<StatusOverviewResponse>(
      "/api/status/overview",
    ),
  getAlerts: (params?: {
    status?: "active" | "resolved";
    severity?: string;
    entity_type?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();

    if (params?.status)
      query.set("status", params.status);
    if (params?.severity)
      query.set("severity", params.severity);
    if (params?.entity_type)
      query.set(
        "entity_type",
        params.entity_type,
      );
    if (params?.search?.trim())
      query.set("search", params.search.trim());
    if (params?.limit)
      query.set("limit", String(params.limit));

    const suffix = query.toString();
    return getJson<Alert[]>(
      `/api/alerts${suffix ? `?${suffix}` : ""}`,
    );
  },
  getHealthHistory: () =>
    getJson<TimeseriesPoint[]>(
      "/api/health/history?minutes=60",
    ),
  getHealthHistoryTcp: () =>
    getJson<TimeseriesPoint[]>(
      "/api/health/history/tcp?minutes=60",
    ),
  getDnsHistory: () =>
    getJson<TimeseriesPoint[]>(
      "/api/dns/history?minutes=60",
    ),
  getSummary: () =>
    getJson<SummaryResponse>(
      "/api/stats/summary",
    ),
  getDevices: () =>
    getJson<Device[]>("/api/devices"),
  getOutages: (params?: {
    status?: "active" | "resolved";
    outage_type?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();

    if (params?.status)
      query.set("status", params.status);
    if (params?.outage_type)
      query.set(
        "outage_type",
        params.outage_type,
      );
    if (params?.search?.trim())
      query.set("search", params.search.trim());
    if (params?.limit)
      query.set("limit", String(params.limit));

    const suffix = query.toString();
    return getJson<Outage[]>(
      `/api/outages${suffix ? `?${suffix}` : ""}`,
    );
  },
  saveKnownDevice: (
    body: SaveKnownDeviceRequest,
  ) => postJson("/api/devices/known", body),
  getDeviceHistory: (ip: string) =>
    getJson<DeviceHistoryItem[]>(
      `/api/devices/${encodeURIComponent(ip)}/history`,
    ),
};
