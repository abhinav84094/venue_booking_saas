import { dateTime } from "./format.js";

export function subscriptionValidity(subscription, timezone = "Asia/Kolkata", now = Date.now()) {
  const start = subscription?.currentPeriodStart;
  const end = subscription?.currentPeriodEnd;
  const endTime = end ? new Date(end).getTime() : NaN;
  return {
    plan: subscription?.planSnapshot?.name || "No plan selected",
    status: subscription?.status || "pending",
    activated:
      start && Number.isFinite(new Date(start).getTime())
        ? dateTime(start, timezone)
        : "Not activated",
    expires: Number.isFinite(endTime) ? dateTime(end, timezone) : "Not activated",
    remainingDays:
      Number.isInteger(subscription?.remainingDays) && subscription.remainingDays >= 0
        ? subscription.remainingDays
        : Number.isFinite(endTime)
          ? Math.max(0, Math.ceil((endTime - now) / 86400000))
          : 0,
    dashboardAccess: subscription?.dashboardAccess === true,
  };
}

export function subscriptionAction(subscription) {
  switch (subscription?.status) {
    case "active":
      return "View subscription";
    case "expired":
      return "Renew subscription";
    case "payment_pending":
      return "Complete payment";
    case "review_required":
      return "Review payment";
    case "suspended":
      return "View subscription";
    default:
      return "Choose plan & pay";
  }
}
