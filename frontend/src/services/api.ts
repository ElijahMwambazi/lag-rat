export type SummaryResponse = {
  uptime_pct_24h: number;
  avg_latency_ms_24h: number;
  outage_count_24h: number;
};

export type ReportSummaryResponse = {
  window_hours: number;
  uptime_pct: number;
  avg_latency_ms: number;
  outage_count: number;
  total_downtime_seconds: number;
  dns_failure_count: number;
  device_history_event_count: number;
  active_alert_count: number;
  active_critical_alert_count: number;
  active_unacknowledged_alert_count: number;
};

export type ClearObservationsResponse = {
  cleared: boolean;
  tables: Array<{
    table: string;
    deleted_rows: number;
  }>;
  total_deleted_rows: number;
  capture_files_deleted: number;
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
  acknowledged_at?: string | null;
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
  alerts: {
    active_count: number;
    active_critical_count: number;
    active_unacknowledged_count: number;
    active_unacknowledged_critical_count: number;
    most_recent_created_at?: string | null;
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
  is_this_device: boolean;
  is_known: boolean;
  confidence: "high" | "medium" | "low";
};

export type KnownDevice = {
  id: number;
  ip_address?: string | null;
  mac_address?: string | null;
  label: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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

export type AlertHistoryItem = {
  id: number;
  event_type: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

export type RecentAlertEventItem = {
  alert_id: number;
  alert_type: string;
  severity: string;
  entity_type: string;
  entity_key: string;
  message: string;
  event_type: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

export type RecentDeviceEventItem = {
  device_ip_address: string;
  event_type: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
};

export type IncidentTargetSummaryItem = {
  incident_type: string;
  target: string;
  count: number;
  active_count: number;
  total_downtime_seconds: number;
  latest_started_at?: string | null;
};

export type ReportTrendPoint = {
  bucket_start: string;
  label: string;
  outage_count: number;
  dns_failure_count: number;
  internet_http_failure_count: number;
  internet_tcp_failure_count: number;
};

export type ProbeMetricsSummaryItem = {
  key: string;
  label: string;
  total_checks: number;
  success_count: number;
  failure_count: number;
  success_rate_pct: number;
  avg_latency_ms: number;
  latest_latency_ms?: number | null;
  last_checked_at?: string | null;
};

export type MetricsSummaryResponse = {
  window_minutes: number;
  items: ProbeMetricsSummaryItem[];
};

export type ReportSnapshotResponse = {
  generated_at: string;
  window_hours: number;
  narrative: string;
  summary: ReportSummaryResponse;
  top_incident_targets: IncidentTargetSummaryItem[];
  recent_alert_events: RecentAlertEventItem[];
  recent_device_events: RecentDeviceEventItem[];
  outages: Outage[];
};

export type WifiSample = {
  id: number;
  location_label: string;
  interface_name: string;
  ssid?: string | null;
  bssid?: string | null;
  rssi_dbm?: number | null;
  frequency_mhz?: number | null;
  band?: string | null;
  sampled_at: string;
};

export type WifiSummaryResponse = {
  window_minutes: number;
  location_label?: string | null;
  sample_count: number;
  avg_rssi_dbm?: number | null;
  min_rssi_dbm?: number | null;
  max_rssi_dbm?: number | null;
  latest_sample?: WifiSample | null;
};

export type WifiLocationsResponse = {
  items: string[];
};

export type WifiLocationSummaryItem = {
  location_label: string;
  sample_count: number;
  avg_rssi_dbm?: number | null;
  min_rssi_dbm?: number | null;
  max_rssi_dbm?: number | null;
  latest_sample?: WifiSample | null;
};

export type WifiLocationSummariesResponse = {
  window_minutes: number;
  items: WifiLocationSummaryItem[];
};

export type AlertHistoryEvent = {
  id: number;
  alert_id: number;
  event_type: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type TrafficTopTalkerItem = {
  interface_name: string;
  entity_type: string;
  entity_key: string;
  device_ip_address: string | null;
  mac_address: string | null;
  latest_bytes_rx: number;
  latest_bytes_tx: number;
  earliest_bytes_rx: number;
  earliest_bytes_tx: number;
  delta_bytes_rx: number;
  delta_bytes_tx: number;
  delta_bytes_total: number;
  latest_sampled_at: string;
};

export type TrafficSummaryResponse = {
  window_minutes: number;
  total_bytes_rx: number;
  total_bytes_tx: number;
  total_bytes: number;
  interface_count: number;
  top_talker: TrafficTopTalkerItem | null;
};

export type TrafficTopTalkersResponse = {
  window_minutes: number;
  items: TrafficTopTalkerItem[];
};

export type TrafficSample = {
  id: number;
  interface_name: string;
  entity_type: string;
  entity_key: string;
  device_ip_address: string | null;
  mac_address: string | null;
  bytes_rx: number;
  bytes_tx: number;
  packets_rx: number | null;
  packets_tx: number | null;
  sampled_at: string;
};

export type CaptureExportRequest = {
  id: number;
  source: string;
  interface_name?: string | null;
  entity_type?: string | null;
  entity_key?: string | null;
  device_ip_address?: string | null;
  mac_address?: string | null;
  window_minutes?: number | null;
  note?: string | null;
  status: string;
  capture_reference?: string | null;
  created_at: string;
  queued_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  cancelled_at?: string | null;
  failure_reason?: string | null;
  duration_seconds?: number | null;
  output_filename?: string | null;
  file_size_bytes?: number | null;
};

export type CreateCaptureExportRequest = {
  source: string;
  interface_name?: string | null;
  entity_type?: string | null;
  entity_key?: string | null;
  device_ip_address?: string | null;
  mac_address?: string | null;
  window_minutes?: number | null;
  note?: string | null;
};

export type DeleteCaptureExportRequestResponse = {
  id: number;
  deleted: boolean;
  file_deleted: boolean;
};

export type CaptureReadinessIssue = {
  key: string;
  severity: string;
  message: string;
  action: string;
};

export type CaptureReadinessResponse = {
  execution_enabled: boolean;
  can_execute: boolean;
  tcpdump_available: boolean;
  output_directory_ready: boolean;
  duration_bounds_valid: boolean;
  allowed_interfaces_valid: boolean;
  allowed_interfaces: string[];
  output_dir: string;
  default_duration_seconds: number;
  min_duration_seconds: number;
  max_duration_seconds: number;
  max_file_mb: number;
  issues: CaptureReadinessIssue[];
};

export type InvestigationSubjectResponse = {
  kind: "incident_target";
  incident_type: string;
  target: string;
  window_hours: number;
};

export type InvestigationSummary = {
  primary_signal: string;
  next_check: string;
  supporting_context: string;
};

export type InvestigationResponse = {
  subject: InvestigationSubjectResponse;
  related_outages: Outage[];
  recent_alert_events: RecentAlertEventItem[];
  likely_devices: Device[];
  traffic_context: TrafficTopTalkerItem | null;
  wifi_context: WifiLocationSummaryItem | null;
  summary: InvestigationSummary;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:8080`;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

async function deleteJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export const api = {
  getStatusOverview: () =>
    getJson<StatusOverviewResponse>("/api/status/overview"),
  getAlerts: (params?: {
    status?: "active" | "resolved";
    severity?: string;
    entity_type?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();

    if (params?.status) query.set("status", params.status);
    if (params?.severity) query.set("severity", params.severity);
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.search?.trim()) query.set("search", params.search.trim());
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString();
    return getJson<Alert[]>(`/api/alerts${suffix ? `?${suffix}` : ""}`);
  },
  acknowledgeAlert: (id: number) =>
    postJson<Alert, Record<string, never>>(`/api/alerts/${id}/acknowledge`, {}),
  getAlertHistory: async (alertId: number) => {
    const response = await fetch(`${API_BASE}/api/alerts/${alertId}/history`);

    if (!response.ok) {
      throw new Error(`Failed to load alert history for alert ${alertId}`);
    }

    return (await response.json()) as AlertHistoryEvent[];
  },
  getHealthHistory: (minutes = 60) =>
    getJson<TimeseriesPoint[]>(`/api/health/history?minutes=${minutes}`),
  getHealthHistoryTcp: (minutes = 60) =>
    getJson<TimeseriesPoint[]>(`/api/health/history/tcp?minutes=${minutes}`),
  getDnsHistory: (minutes = 60) =>
    getJson<TimeseriesPoint[]>(`/api/dns/history?minutes=${minutes}`),
  getSummary: () => getJson<SummaryResponse>("/api/stats/summary"),
  getReportsSummary: (hours = 24) =>
    getJson<ReportSummaryResponse>(`/api/reports/summary?hours=${hours}`),
  getReportTrends: (hours = 24) =>
    getJson<ReportTrendPoint[]>(`/api/reports/trends?hours=${hours}`),
  getMetricsSummary: (minutes = 60) =>
    getJson<MetricsSummaryResponse>(`/api/metrics/summary?minutes=${minutes}`),
  getReportsSnapshot: (hours = 24) =>
    getJson<ReportSnapshotResponse>(`/api/reports/snapshot?hours=${hours}`),
  getRecentReportAlertEvents: (hours = 24) =>
    getJson<RecentAlertEventItem[]>(
      `/api/reports/alerts/recent?hours=${hours}`,
    ),
  getRecentReportDeviceEvents: (hours = 24) =>
    getJson<RecentDeviceEventItem[]>(
      `/api/reports/devices/recent?hours=${hours}`,
    ),
  getTopIncidentTargets: (hours = 24) =>
    getJson<IncidentTargetSummaryItem[]>(
      `/api/reports/incidents/top?hours=${hours}`,
    ),
  getDevices: (params?: { include_low_confidence?: boolean }) => {
    const query = new URLSearchParams();

    if (params?.include_low_confidence) {
      query.set("include_low_confidence", "true");
    }

    const suffix = query.toString();

    return getJson<Device[]>(`/api/devices${suffix ? `?${suffix}` : ""}`);
  },
  getOutages: (params?: {
    status?: "active" | "resolved";
    outage_type?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();

    if (params?.status) query.set("status", params.status);
    if (params?.outage_type) query.set("outage_type", params.outage_type);
    if (params?.search?.trim()) query.set("search", params.search.trim());
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString();
    return getJson<Outage[]>(`/api/outages${suffix ? `?${suffix}` : ""}`);
  },
  saveKnownDevice: (body: SaveKnownDeviceRequest) =>
    postJson<KnownDevice, SaveKnownDeviceRequest>("/api/devices/known", body),
  getDeviceHistory: (ip: string) =>
    getJson<DeviceHistoryItem[]>(
      `/api/devices/${encodeURIComponent(ip)}/history`,
    ),
  getWifiSamples: (params?: {
    minutes?: number;
    location_label?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();

    if (params?.minutes) query.set("minutes", String(params.minutes));
    if (params?.location_label?.trim())
      query.set("location_label", params.location_label.trim());
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString();
    return getJson<WifiSample[]>(
      `/api/wifi/samples${suffix ? `?${suffix}` : ""}`,
    );
  },

  getLatestWifiSample: async (): Promise<WifiSample | null> => {
    const response = await fetch(`${API_BASE}/api/wifi/latest`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<WifiSample>;
  },

  getWifiSummary: (params?: { minutes?: number; location_label?: string }) => {
    const query = new URLSearchParams();

    if (params?.minutes) query.set("minutes", String(params.minutes));
    if (params?.location_label?.trim())
      query.set("location_label", params.location_label.trim());

    const suffix = query.toString();
    return getJson<WifiSummaryResponse>(
      `/api/wifi/summary${suffix ? `?${suffix}` : ""}`,
    );
  },

  getWifiLocations: () => getJson<WifiLocationsResponse>("/api/wifi/locations"),
  getWifiLocationSummaries: (params?: { minutes?: number }) => {
    const query = new URLSearchParams();

    if (params?.minutes) {
      query.set("minutes", String(params.minutes));
    }

    const suffix = query.toString();
    return getJson<WifiLocationSummariesResponse>(
      `/api/wifi/locations/summary${suffix ? `?${suffix}` : ""}`,
    );
  },
  getTrafficSummary: (minutes = 60) =>
    getJson<TrafficSummaryResponse>(`/api/traffic/summary?minutes=${minutes}`),

  getTrafficTopTalkers: (minutes = 60, limit = 5) =>
    getJson<TrafficTopTalkersResponse>(
      `/api/traffic/top-talkers?minutes=${minutes}&limit=${limit}`,
    ),
  getTrafficSamples: (minutes = 60, limit = 20) =>
    getJson<TrafficSample[]>(
      `/api/traffic/samples?minutes=${minutes}&limit=${limit}`,
    ),
  createCaptureExportRequest: (body: CreateCaptureExportRequest) =>
    postJson<CaptureExportRequest, CreateCaptureExportRequest>(
      "/api/captures/export-requests",
      body,
    ),
  deleteCaptureExportRequest: (id: number) =>
    deleteJson<DeleteCaptureExportRequestResponse>(
      `/api/captures/export-requests/${id}`,
    ),
  getCaptureReadiness: () =>
    getJson<CaptureReadinessResponse>("/api/captures/readiness"),
  getCaptureExportRequests: (limit = 20) =>
    getJson<CaptureExportRequest[]>(
      `/api/captures/export-requests?limit=${limit}`,
    ),
  getInvestigation: (params: {
    incident_type: string;
    target: string;
    hours?: number;
  }) => {
    const query = new URLSearchParams();

    query.set("incident_type", params.incident_type);
    query.set("target", params.target);

    if (params.hours) {
      query.set("hours", String(params.hours));
    }

    return getJson<InvestigationResponse>(
      `/api/investigations?${query.toString()}`,
    );
  },
  getCaptureExportRequest: (id: number) =>
    getJson<CaptureExportRequest>(`/api/captures/export-requests/${id}`),

  queueCaptureExportRequest: (id: number) =>
    postJson<CaptureExportRequest, Record<string, never>>(
      `/api/captures/export-requests/${id}/queue`,
      {},
    ),

  cancelCaptureExportRequest: (id: number) =>
    postJson<CaptureExportRequest, Record<string, never>>(
      `/api/captures/export-requests/${id}/cancel`,
      {},
    ),
  clearObservations: (confirmation: string) =>
    postJson<ClearObservationsResponse, { confirmation: string }>(
      "/api/maintenance/clear-observations",
      { confirmation },
    ),
};
