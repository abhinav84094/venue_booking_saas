import { Subscription, SubscriptionPayment } from "../../models/venueModels.js";
import { must } from "../../utils/errors.js";
export const subscriptionIsActive = (sub, now = new Date()) =>
  Boolean(
    sub?.status === "active" &&
    sub.currentPeriodStart instanceof Date &&
    sub.currentPeriodEnd instanceof Date &&
    Number.isFinite(sub.currentPeriodStart.getTime()) &&
    Number.isFinite(sub.currentPeriodEnd.getTime()) &&
    sub.currentPeriodStart <= now &&
    sub.currentPeriodEnd > now &&
    sub.currentPeriodStart < sub.currentPeriodEnd,
  );
// Access is derived from a verified payment AND the half-open UTC validity period.
// VENUE_SUBSCRIPTION_MODE=off never bypasses payment-first authorization.
export async function hasVerifiedPayment(sub, session = null) {
  if (!sub?.activePaymentId || !sub.hallId || !sub.ownerId) return false;
  return Boolean(
    await SubscriptionPayment.exists({
      _id: sub.activePaymentId,
      subscriptionId: sub._id,
      ownerId: sub.ownerId,
      venueId: sub.venueId,
      hallId: sub.hallId,
      planId: sub.planId,
      status: "paid",
      razorpayPaymentId: { $type: "string", $ne: "" },
    }).session(session),
  );
}
export async function getHallSubscriptionState(
  venueId,
  hallId,
  { session = null, now = new Date() } = {},
) {
  const sub = await Subscription.findOne({ venueId, hallId }).session(session).lean();
  const paid = await hasVerifiedPayment(sub, session);
  const verified = subscriptionIsActive(sub, now) && paid;
  let status = sub?.status || "pending";
  if (status === "active")
    status = sub.currentPeriodEnd <= now ? "expired" : verified ? "active" : "pending";
  const pending = !verified
    ? await SubscriptionPayment.findOne({
        venueId,
        hallId,
        status: { $in: ["created", "review_required"] },
      })
        .sort({ createdAt: -1 })
        .session(session)
        .lean()
    : null;
  if (status === "pending" && pending?.status === "review_required") status = "review_required";
  else if (
    ["pending", "expired"].includes(status) &&
    (sub?.checkoutLock || pending?.status === "created")
  )
    status = "payment_pending";
  const selected =
    status === "payment_pending" ? pending || sub?.checkoutDraft : paid ? sub : pending;
  return {
    planId: selected?.planId,
    planSnapshot: selected?.planSnapshot,
    currentPeriodStart: paid ? sub.currentPeriodStart : undefined,
    currentPeriodEnd: paid ? sub.currentPeriodEnd : undefined,
    status,
    dashboardAccess: Boolean(verified),
    remainingDays:
      paid && sub?.currentPeriodEnd
        ? Math.max(0, Math.ceil((sub.currentPeriodEnd - now) / 86400000))
        : 0,
  };
}
export async function requireHallEntitlement(venueId, hallId, session = null) {
  const sub = await Subscription.findOne({ venueId, hallId }).session(session);
  must(
    subscriptionIsActive(sub) && (await hasVerifiedPayment(sub, session)),
    "Verified payment and an active subscription for this hall are required",
    402,
  );
  return sub;
}
export async function requireFeature(venueId, hallId, feature, session = null) {
  const sub = await requireHallEntitlement(venueId, hallId, session);
  must(
    sub.planSnapshot?.features?.[feature] === true,
    "An active hall subscription with this feature is required",
    403,
  );
}
