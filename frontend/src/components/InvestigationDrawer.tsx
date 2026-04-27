import { useQuery } from "@tanstack/react-query";
import SideDrawer from "./SideDrawer";
import DrawerDetailSection from "./DrawerDetailSection";
import {
  api,
  type Alert,
  type IncidentTargetSummaryItem,
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

export default function InvestigationDrawer({
  open,
  subject,
  onClose,
  onOpenOutageExplorer,
}: InvestigationDrawerProps) {
  const target = subject ? getSubjectTarget(subject) : "";
  const incidentType = subject ? getSubjectType(subject) : "";
  const windowHours = subject ? getSubjectWindowHours(subject) : 24;

  const investigationQuery = useQuery({
    queryKey: ["investigation", incidentType, target, windowHours],
    queryFn: () =>
      api.getInvestigation({
        incident_type: incidentType,
        target,
        hours: windowHours,
      }),
    enabled: open && !!subject && !!incidentType && !!target,
  });

  if (!subject) {
    return null;
  }

  const investigation = investigationQuery.data;

  const relatedOutages = investigation?.related_outages ?? [];
  const recentAlertEvents = investigation?.recent_alert_events ?? [];
  const likelyDevices = investigation?.likely_devices ?? [];
  const trafficContext = investigation?.traffic_context ?? null;
  const wifiContext = investigation?.wifi_context ?? null;

  const operatorSummary = investigation
    ? [
        relatedOutages.some((outage) => outage.is_active)
          ? `${relatedOutages.filter((outage) => outage.is_active).length} related outage${
              relatedOutages.filter((outage) => outage.is_active).length === 1
                ? ""
                : "s"
            } still active.`
          : relatedOutages.length > 0
            ? "Related outages exist, but none are currently active."
            : "No matching outage records found in this window.",
        recentAlertEvents.length > 0
          ? `${recentAlertEvents.length} recent alert event${
              recentAlertEvents.length === 1 ? "" : "s"
            } may be related.`
          : "No recent related alert events found.",
        likelyDevices.length > 0
          ? `${likelyDevices.length} likely device candidate${
              likelyDevices.length === 1 ? "" : "s"
            } matched the target.`
          : "No device candidate matched the target directly.",
      ].join(" ")
    : "Loading investigation context...";

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
      : `${formatIncidentType(subject.target.incident_type)} · Last ${
          windowHours === 24 ? "24h" : "7d"
        }`;

  return (
    <SideDrawer
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      widthClass="max-w-2xl"
    >
      {investigationQuery.isLoading ? (
        <DrawerDetailSection label="Investigation">
          <p className="text-sm text-zinc-400">
            Loading investigation context...
          </p>
        </DrawerDetailSection>
      ) : null}

      {investigationQuery.isError ? (
        <DrawerDetailSection label="Investigation unavailable">
          <p className="text-sm text-red-300">
            Could not load investigation context.
          </p>
        </DrawerDetailSection>
      ) : null}

      {investigation ? (
        <DrawerDetailSection label="Likely cause summary">
          <div className="grid gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Primary signal
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-200">
                {investigation.summary.primary_signal}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Most useful next check
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-200">
                {investigation.summary.next_check}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Supporting context
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-200">
                {investigation.summary.supporting_context}
              </p>
            </div>
          </div>
        </DrawerDetailSection>
      ) : null}

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
        {investigationQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading related outages...</p>
        ) : investigationQuery.isError ? (
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
        {investigationQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading alert events...</p>
        ) : investigationQuery.isError ? (
          <p className="text-sm text-red-300">Could not load alert events.</p>
        ) : recentAlertEvents.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No related alert events found in this window.
          </p>
        ) : (
          <div className="space-y-2">
            {recentAlertEvents.map((event) => (
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
        {investigationQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading device candidates...</p>
        ) : investigationQuery.isError ? (
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
        {investigationQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading traffic context...</p>
        ) : investigationQuery.isError ? (
          <p className="text-sm text-zinc-400">
            Traffic context is unavailable.
          </p>
        ) : trafficContext ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-100">
              Matching top talker
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {trafficContext.device_ip_address ??
                trafficContext.mac_address ??
                trafficContext.entity_key}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              RX {formatBytes(trafficContext.delta_bytes_rx)} · TX{" "}
              {formatBytes(trafficContext.delta_bytes_tx)} · Total{" "}
              {formatBytes(trafficContext.delta_bytes_total)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            No traffic top-talker context available.
          </p>
        )}
      </DrawerDetailSection>

      <DrawerDetailSection label="Weakest Wi-Fi context">
        {investigationQuery.isLoading ? (
          <p className="text-sm text-zinc-400">Loading Wi-Fi context...</p>
        ) : investigationQuery.isError ? (
          <p className="text-sm text-zinc-400">Wi-Fi context is unavailable.</p>
        ) : wifiContext ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-100">
              {wifiContext.location_label}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Weakest latest signal:{" "}
              {formatRssi(wifiContext.latest_sample?.rssi_dbm)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {wifiContext.latest_sample?.ssid ?? "Unknown SSID"}
              {wifiContext.latest_sample?.band
                ? ` · ${wifiContext.latest_sample.band}`
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
