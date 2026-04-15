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
    case "wifi":
      return "Wi-Fi";
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

  if (
    lower.includes("wifi signal is very weak")
  ) {
    return "Very weak Wi-Fi signal";
  }

  if (lower.includes("wifi signal is weak")) {
    return "Weak Wi-Fi signal";
  }

  if (lower.includes("wifi samples are stale")) {
    return "Wi-Fi samples are stale";
  }

  if (
    lower.includes(
      "wifi samples are getting stale",
    )
  ) {
    return "Wi-Fi samples are getting stale";
  }

  if (lower.includes("wifi sampling recovered")) {
    return "Wi-Fi sampling recovered";
  }

  if (lower.includes("wifi signal recovered")) {
    return "Wi-Fi signal recovered";
  }

  if (lower.includes("recovered")) {
    return "Service recovered";
  }

  return value;
}

export function buildAlertHeadline(params: {
  entityType: string;
  entityKey: string;
  message: string;
}) {
  const { entityType, entityKey, message } =
    params;
  const incident = formatIncidentType(entityType);
  const lower = message.toLowerCase();

  if (entityType === "wifi") {
    if (
      lower.includes("wifi signal is very weak")
    ) {
      return `Very weak Wi-Fi signal in ${entityKey}`;
    }

    if (lower.includes("wifi signal is weak")) {
      return `Weak Wi-Fi signal in ${entityKey}`;
    }

    if (
      lower.includes("wifi samples are stale")
    ) {
      return `Wi-Fi samples stale in ${entityKey}`;
    }

    if (
      lower.includes(
        "wifi samples are getting stale",
      )
    ) {
      return `Wi-Fi samples getting stale in ${entityKey}`;
    }

    if (lower.includes("wifi signal recovered")) {
      return `Wi-Fi signal recovered in ${entityKey}`;
    }

    if (
      lower.includes("wifi sampling recovered")
    ) {
      return `Wi-Fi sampling recovered in ${entityKey}`;
    }

    return `Wi-Fi alert in ${entityKey}`;
  }

  if (lower.includes("timed out")) {
    return `${incident} probe timed out`;
  }

  if (lower.includes("recovered")) {
    return `${incident} recovered`;
  }

  if (lower.includes("failed")) {
    return `${incident} check failed`;
  }

  return incident;
}

export function buildAlertSubtext(params: {
  entityType: string;
  entityKey: string;
  message: string;
}) {
  const { entityType, entityKey, message } =
    params;

  return {
    targetLabel:
      entityType === "wifi"
        ? `Room: ${entityKey}`
        : `Target: ${entityKey}`,
    causeLabel: summarizeOutageCause(message),
  };
}

export function formatAlertEventTransition(params: {
  eventType: string;
  previousValue?: string | null;
  newValue?: string | null;
}) {
  const { eventType, previousValue, newValue } =
    params;

  switch (eventType) {
    case "opened":
      return newValue
        ? `Severity set to ${newValue}`
        : "Alert opened";

    case "severity_changed":
      return previousValue && newValue
        ? `Severity: ${previousValue} → ${newValue}`
        : "Severity changed";

    case "message_changed":
      return "Alert message updated";

    case "acknowledged":
      return "Marked as acknowledged";

    case "resolved":
      return "Alert recovered";

    default:
      if (!previousValue && !newValue)
        return null;
      if (!previousValue && newValue)
        return `Set to ${newValue}`;
      if (previousValue && !newValue)
        return `Removed: ${previousValue}`;
      return `${previousValue} → ${newValue}`;
  }
}
