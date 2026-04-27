import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import SideDrawer from "./SideDrawer";
import DrawerDetailSection from "./DrawerDetailSection";
import {
  api,
  type Alert,
  type Device,
  type IncidentTargetSummaryItem,
  type RecentAlertEventItem,
  type TrafficTopTalkerItem,
  type WifiLocationSummaryItem,
} from "../services/api";
import {
  buildAlertHeadline,
  buildAlertSubtext,
  formatIncidentType,
} from "../utils/incidentText";

export type InvestigationSubject =
  | {
      kind: "alert";
      alert: Alert;
      windowHours?: 24 | 168;
    }
  | {
      kind: "incident-target";
      target: IncidentTargetSummaryItem;
      windowHours: 24 | 168;
    };

type InvestigationDrawerProps = {
  open: boolean;
  subject: InvestigationSubject | null;
  onClose: () => void;
  onOpenOutageExplorer?: () => void;
};

const outageTypes = new Set(["internet_http", "internet_tcp", "dns", "router"]);

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatDurationCompact(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatRssi(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value} dBm`;
}

function startsWithinWindow(startedAt: string, windowHours: 24 | 168) {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return false;

  const windowStart = Date.now() - windowHours * 60 * 60 * 1000;
  return started.getTime() >= windowStart;
}

function includesTarget(value: string | null | undefined, target: string) {
  return value?.toLowerCase().includes(target.toLowerCase()) ?? false;
}

function getSubjectTarget(subject: InvestigationSubject) {
  return subject.kind === "alert"
    ? subject.alert.entity_key
    : subject.target.target;
}

function getSubjectType(subject: InvestigationSubject) {
  return subject.kind === "alert"
    ? subject.alert.entity_type
    : subject.target.incident_type;
}

function getSubjectWindowHours(subject: InvestigationSubject) {
  return subject.kind === "alert"
    ? (subject.windowHours ?? 24)
    : subject.windowHours;
}

function getWeakestWifiRoom(items: WifiLocationSummaryItem[]) {
  return [...items]
    .filter(
      (item) =>
        item.latest_sample?.rssi_dbm !== null &&
        item.latest_sample?.rssi_dbm !== undefined,
    )
    .sort(
      (a, b) =>
        (a.latest_sample?.rssi_dbm ?? 0) - (b.latest_sample?.rssi_dbm ?? 0),
    )[0];
}

function getLikelyDevices(devices: Device[], target: string) {
  return devices.filter(
    (device) =>
      includesTarget(device.ip_address, target) ||
      includesTarget(device.mac_address, target) ||
      includesTarget(device.hostname, target) ||
      includesTarget(device.display_name, target) ||
      includesTarget(device.label, target),
  );
}

function getRelatedAlertEvents(
  items: RecentAlertEventItem[],
  target: string,
  incidentType: string,
) {
  return items.filter(
    (item) =>
      item.entity_key === target ||
      item.entity_type === incidentType ||
      includesTarget(item.message, target),
  );
}

function getTrafficMatch(items: TrafficTopTalkerItem[], target: string) {
  return (
    items.find(
      (item) =>
        item.device_ip_address === target ||
        item.mac_address === target ||
        item.entity_key === target ||
        item.interface_name === target,
    ) ?? null
  );
}

function buildInvestigationGuidance({
  incidentType,
  activeOutageCount,
  relatedOutageCount,
  relatedAlertEventCount,
  likelyDeviceCount,
  hasMatchingTraffic,
  hasWeakWifiContext,
}: {
  incidentType: string;
  activeOutageCount: number;
  relatedOutageCount: number;
  relatedAlertEventCount: number;
  likelyDeviceCount: number;
  hasMatchingTraffic: boolean;
  hasWeakWifiContext: boolean;
}) {
  const formattedType = formatIncidentType(incidentType);

  const primarySignal =
    activeOutageCount > 0
      ? `${formattedType} still has active outage evidence in this window.`
      : relatedOutageCount > 0
        ? `${formattedType} has recovered outage evidence in this window.`
        : `${formattedType} has no matching outage record in this window.`;

  let nextCheck =
    "Review the related outages and alert events before changing device-specific settings.";

  if (incidentType === "router") {
    nextCheck =
      "Check the router path first: power, cabling, router admin reachability, and local gateway status.";
  } else if (incidentType === "dns") {
    nextCheck =
      "Check DNS next: compare resolver behavior, lookup timing, and whether internet TCP/HTTP stayed healthy.";
  } else if (
    incidentType === "internet_http" ||
    incidentType === "internet_tcp" ||
    incidentType === "internet"
  ) {
    nextCheck =
      "Check the internet path first: router uplink, ISP behavior, and whether DNS or device-specific Wi-Fi also degraded.";
  } else if (likelyDeviceCount > 0) {
    nextCheck =
      "Check the matched device first, then compare it against wider network signals.";
  } else if (hasWeakWifiContext) {
    nextCheck =
      "Check Wi-Fi context next, especially if the affected device is in the weakest room or band.";
  }

  const supportingContext = [
    `${relatedOutageCount} related outage${relatedOutageCount === 1 ? "" : "s"}`,
    `${relatedAlertEventCount} alert event${relatedAlertEventCount === 1 ? "" : "s"}`,
    `${likelyDeviceCount} device candidate${likelyDeviceCount === 1 ? "" : "s"}`,
    hasMatchingTraffic ? "matching traffic context" : "no direct traffic match",
    hasWeakWifiContext
      ? "Wi-Fi context available"
      : "no Wi-Fi room signal context",
  ].join(" · ");

  return {
    primarySignal,
    nextCheck,
    supportingContext,
  };
}

export default function InvestigationDrawer({
  open,
  subject,
  onClose,
  onOpenOutageExplorer,
}: InvestigationDrawerProps) {
  const target = subject ? getSubjectTarget(subject) : "";
  const incidentType = subject ? getSubjectType(subject) : "";
  const windowHours = subject ? getSubjectWindowHours(subject) : 24;

  const outageType = outageTypes.has(incidentType) ? incidentType : undefined;

  const outagesQuery = useQuery({
    queryKey: ["investigation", "outages", target, incidentType, windowHours],
    queryFn: () =>
      api.getOutages({
        outage_type: outageType,
        search: target,
        limit: 200,
      }),
    enabled: open && !!subject,
  });

  const alertEventsQuery = useQuery({
    queryKey: ["investigation", "recent-alert-events", windowHours],
    queryFn: () => api.getRecentReportAlertEvents(windowHours),
    enabled: open && !!subject,
  });

  const devicesQuery = useQuery({
    queryKey: ["investigation", "devices"],
    queryFn: () => api.getDevices(),
    enabled: open && !!subject,
  });

  const trafficQuery = useQuery({
    queryKey: ["investigation", "traffic-top-talkers", 60],
    queryFn: () => api.getTrafficTopTalkers(60, 5),
    enabled: open && !!subject,
    retry: false,
  });

  const wifiQuery = useQuery({
    queryKey: ["investigation", "wifi-location-summaries", 60],
    queryFn: () =>
      api.getWifiLocationSummaries({
        minutes: 60,
      }),
    enabled: open && !!subject,
    retry: false,
  });

  const relatedOutages = useMemo(
    () =>
      (outagesQuery.data ?? []).filter((outage) =>
        startsWithinWindow(outage.started_at, windowHours),
      ),
    [outagesQuery.data, windowHours],
  );

  const relatedAlertEvents = useMemo(
    () =>
      getRelatedAlertEvents(
        alertEventsQuery.data ?? [],
        target,
        incidentType,
      ).slice(0, 5),
    [alertEventsQuery.data, target, incidentType],
  );

  const likelyDevices = useMemo(
    () => getLikelyDevices(devicesQuery.data ?? [], target).slice(0, 5),
    [devicesQuery.data, target],
  );

  const trafficItems = trafficQuery.data?.items ?? [];
  const matchingTraffic = getTrafficMatch(trafficItems, target);
  const topTraffic = matchingTraffic ?? trafficItems[0] ?? null;

  const wifiItems = wifiQuery.data?.items ?? [];
  const weakestWifiRoom = getWeakestWifiRoom(wifiItems);

  const activeOutageCount = relatedOutages.filter(
    (outage) => outage.is_active,
  ).length;

  const investigationGuidance = buildInvestigationGuidance({
    incidentType,
    activeOutageCount,
    relatedOutageCount: relatedOutages.length,
    relatedAlertEventCount: relatedAlertEvents.length,
    likelyDeviceCount: likelyDevices.length,
    hasMatchingTraffic: !!matchingTraffic,
    hasWeakWifiContext: !!weakestWifiRoom,
  });

  const operatorSummary = [
    activeOutageCount > 0
      ? `${activeOutageCount} related outage${activeOutageCount === 1 ? "" : "s"} still active.`
      : relatedOutages.length > 0
        ? "Related outages exist, but none are currently active."
        : "No matching outage records found in this window.",
    relatedAlertEvents.length > 0
      ? `${relatedAlertEvents.length} recent alert event${relatedAlertEvents.length === 1 ? "" : "s"} may be related.`
      : "No recent related alert events found.",
    likelyDevices.length > 0
      ? `${likelyDevices.length} likely device candidate${likelyDevices.length === 1 ? "" : "s"} matched the target.`
      : "No device candidate matched the target directly.",
  ].join(" ");

  if (!subject) {
    return null;
  }

  const title =
    subject.kind === "alert"
      ? "Incident investigation"
      : `Investigate ${subject.target.target}`;

  const subtitle =
    subject.kind === "alert"
      ? buildAlertHeadline({
          entityType: subject.alert.entity_type,
          entityKey: subject.alert.entity_key,
          message: subject.alert.message,
        })
      : `${formatIncidentType(subject.target.incident_type)} · Last ${windowHours === 24 ? "24h" : "7d"}`;

  return (
    <SideDrawer
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      widthClass="max-w-2xl"
    >
      <DrawerDetailSection label="Likely cause summary">
        <div className="grid gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Primary signal
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-200">
              {investigationGuidance.primarySignal}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Most useful next check
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-200">
              {investigationGuidance.nextCheck}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Supporting context
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-200">
              {investigationGuidance.supportingContext}
            </p>
          </div>
        </div>
      </DrawerDetailSection>

      <DrawerDetailSection label="Operator summary">
        <p className="text-sm leading-6 text-zinc-300">{operatorSummary}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Target
            </div>
            <div className="mt-1 break-words text-sm text-zinc-100">
              {target}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Type
            </div>
            <div className="mt-1 text-sm text-zinc-100">
              {formatIncidentType(incidentType)}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Window
            </div>
            <div className="mt-1 text-sm text-zinc-100">
              Last {windowHours === 24 ? "24h" : "7d"}
            </div>
          </div>
        </div>

        {onOpenOutageExplorer ? (
          <button
            type="button"
            onClick={onOpenOutageExplorer}
            className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Open matching outages
          </button>
        ) : null}
      </DrawerDetailSection>

      {subject.kind === "alert" ? (
        <DrawerDetailSection label="Primary alert">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-zinc-100">
              {buildAlertHeadline({
                entityType: subject.alert.entity_type,
                entityKey: subject.alert.entity_key,
                message: subject.alert.message,
              })}
            </p>
            <p className="text-zinc-400">
              {
                buildAlertSubtext({
                  entityType: subject.alert.entity_type,
                  entityKey: subject.alert.entity_key,
                  message: subject.alert.message,
                }).targetLabel
              }
            </p>
            <p className="text-xs text-zinc-500">
              {subject.alert.severity} · Opened{" "}
              {formatDate(subject.alert.created_at)}
            </p>
          </div>
        </DrawerDetailSection>
      ) : (
        <DrawerDetailSection label="Primary incident target">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Incidents
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {subject.target.count}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Active
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {subject.target.active_count}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Downtime
              </div>
              <div className="mt-1 text-sm text-zinc-100">
                {formatDurationCompact(subject.target.total_downtime_seconds)}
              </div>
            </div>
          </div>
        </DrawerDetailSection>
      )}

      <DrawerDetailSection label="Related outages">
        {outagesQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading related outages...</p>
        ) : outagesQuery.isError ? (
          <p className="text-sm text-red-300">
            Could not load related outages.
          </p>
        ) : relatedOutages.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No related outage records found for this target in the selected
            window.
          </p>
        ) : (
          <div className="space-y-2">
            {relatedOutages.slice(0, 5).map((outage) => (
              <div
                key={outage.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {formatIncidentType(outage.outage_type)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {outage.target}
                    </p>
                  </div>

                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {outage.status}
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  Started {formatDate(outage.started_at)} · Duration{" "}
                  {formatDurationCompact(outage.duration_seconds)}
                </p>

                {outage.start_error ? (
                  <p className="mt-2 break-words text-xs text-zinc-500">
                    {outage.start_error}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </DrawerDetailSection>

      <DrawerDetailSection label="Recent alert events">
        {alertEventsQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading alert events...</p>
        ) : alertEventsQuery.isError ? (
          <p className="text-sm text-red-300">Could not load alert events.</p>
        ) : relatedAlertEvents.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No related alert events found in this window.
          </p>
        ) : (
          <div className="space-y-2">
            {relatedAlertEvents.map((event) => (
              <div
                key={`${event.alert_id}-${event.event_type}-${event.created_at}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <p className="text-sm font-medium text-zinc-100">
                  {event.event_type.replace(/_/g, " ")}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-300">
                  {event.message}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {event.severity} · {formatDate(event.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </DrawerDetailSection>

      <DrawerDetailSection label="Likely device candidates">
        {devicesQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading device candidates...</p>
        ) : devicesQuery.isError ? (
          <p className="text-sm text-red-300">
            Could not load device candidates.
          </p>
        ) : likelyDevices.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No device matched this target directly by IP, MAC, hostname, label,
            or display name.
          </p>
        ) : (
          <div className="space-y-2">
            {likelyDevices.map((device) => (
              <div
                key={device.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <p className="text-sm font-medium text-zinc-100">
                  {device.display_name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {device.ip_address}
                  {device.mac_address ? ` · ${device.mac_address}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {device.is_recent ? "Recently active" : "Not recently active"}{" "}
                  · {device.confidence} confidence
                </p>
              </div>
            ))}
          </div>
        )}
      </DrawerDetailSection>

      <DrawerDetailSection label="Traffic context">
        {trafficQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading traffic context...</p>
        ) : trafficQuery.isError ? (
          <p className="text-sm text-zinc-400">
            Traffic context is unavailable.
          </p>
        ) : topTraffic ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-100">
              {matchingTraffic ? "Matching top talker" : "Current top talker"}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {topTraffic.device_ip_address ??
                topTraffic.mac_address ??
                topTraffic.entity_key}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              RX {formatBytes(topTraffic.delta_bytes_rx)} · TX{" "}
              {formatBytes(topTraffic.delta_bytes_tx)} · Total{" "}
              {formatBytes(topTraffic.delta_bytes_total)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            No traffic top-talker context available.
          </p>
        )}
      </DrawerDetailSection>

      <DrawerDetailSection label="Weakest Wi-Fi context">
        {wifiQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading Wi-Fi context...</p>
        ) : wifiQuery.isError ? (
          <p className="text-sm text-zinc-400">Wi-Fi context is unavailable.</p>
        ) : weakestWifiRoom ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-100">
              {weakestWifiRoom.location_label}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Weakest latest signal:{" "}
              {formatRssi(weakestWifiRoom.latest_sample?.rssi_dbm)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {weakestWifiRoom.latest_sample?.ssid ?? "Unknown SSID"}
              {weakestWifiRoom.latest_sample?.band
                ? ` · ${weakestWifiRoom.latest_sample.band}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            No Wi-Fi room summaries available.
          </p>
        )}
      </DrawerDetailSection>
    </SideDrawer>
  );
}
