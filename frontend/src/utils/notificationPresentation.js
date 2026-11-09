const SAFE_NOTIFICATION_PATHS = new Set([
  "/student/applications",
  "/student/offers",
  "/recruiter/jobs",
  "/recruiter/offers",
  "/placement-officer/offers",
  "/placement-officer/dashboard",
  "/admin/dashboard",
]);

export function safeNotificationPath(value) {
  return SAFE_NOTIFICATION_PATHS.has(value) ? value : "/notifications";
}

export function notificationDateTime(value) {
  if (value === null || value === undefined || value === "") return { label: "Time unavailable", dateTime: undefined };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: "Time unavailable", dateTime: undefined };
  return {
    label: date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    dateTime: date.toISOString(),
  };
}
