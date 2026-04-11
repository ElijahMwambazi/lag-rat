import type { Outage } from "../services/api";
import DrawerDetailSection from "./DrawerDetailSection";
import SideDrawer from "./SideDrawer";
import {
  formatIncidentState,
  formatIncidentType,
} from "../utils/incidentText";

type Props = {
  outage: Outage | null;
  open: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Invalid: ${value}`
    : parsed.toLocaleString();
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) {
    return "—";
  }
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function OutageDetailDrawer({
  outage,
  open,
  onClose,
}: Props) {
  if (!open || !outage) {
    return null;
  }

  return (
    <SideDrawer
      open={open}
      title={formatIncidentType(
        outage.outage_type,
      )}
      subtitle="Incident details"
      onClose={onClose}
    >
      <DrawerDetailSection label="Target">
        <div className="break-all">
          {outage.target}
        </div>
      </DrawerDetailSection>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DrawerDetailSection label="Started">
          {formatDate(outage.started_at)}
        </DrawerDetailSection>

        <DrawerDetailSection label="Ended">
          {formatDate(outage.ended_at)}
        </DrawerDetailSection>

        <DrawerDetailSection label="Duration">
          {formatDuration(
            outage.duration_seconds,
          )}
        </DrawerDetailSection>

        <DrawerDetailSection label="Status">
          {formatIncidentState(outage.status)}
        </DrawerDetailSection>
      </div>

      <DrawerDetailSection label="Technical cause">
        <div className="whitespace-pre-wrap break-words">
          {outage.start_error ?? "—"}
        </div>
      </DrawerDetailSection>

      <DrawerDetailSection label="Recovery note">
        <div className="whitespace-pre-wrap break-words">
          {outage.end_note ?? "—"}
        </div>
      </DrawerDetailSection>
    </SideDrawer>
  );
}
