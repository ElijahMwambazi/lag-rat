export function formatIncidentType(
  value?: string | null,
) {
  switch (value) {
    case "internet_http":
      return "Web connectivity";
    case "internet_tcp":
      return "Internet TCP";
    case "dns":
      return "DNS";
    case "router":
    case "router_tcp":
      return "Router";
    default:
      return value
        ? value.replace(/_/g, " ")
        : "Unknown";
  }
}

export function formatIncidentState(
  value?: string | null,
) {
  if (value === "active") return "Ongoing";
  if (value === "resolved") return "Recovered";
  return value ? value.replace(/_/g, " ") : "—";
}

export function summarizeOutageCause(
  value?: string | null,
) {
  if (!value) return "—";

  const lower = value.toLowerCase();

  if (lower.includes("tcp probe timed out")) {
    return "TCP probe timed out";
  }

  if (
    lower.includes("dns") &&
    lower.includes("timed out")
  ) {
    return "DNS lookup timed out";
  }

  if (
    lower.includes("error sending request") ||
    lower.includes("unexpected status")
  ) {
    return "Web probe request failed";
  }

  return value;
}

export function buildAlertHeadline(params: {
  entityType: string;
  entityKey: string;
  message: string;
}) {
  const { entityType, message } = params;
  const incident = formatIncidentType(entityType);

  const lower = message.toLowerCase();

  if (lower.includes("timed out")) {
    return `${incident} probe timed out`;
  }

  if (lower.includes("failed")) {
    return `${incident} check failed`;
  }

  if (lower.includes("recovered")) {
    return `${incident} recovered`;
  }

  return incident;
}

export function buildAlertSubtext(params: {
  entityType: string;
  entityKey: string;
  message: string;
}) {
  const { entityKey, message } = params;
  const cause = summarizeOutageCause(message);

  return {
    targetLabel: `Target: ${entityKey}`,
    causeLabel: cause,
  };
}
