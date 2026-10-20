import crypto from "node:crypto";
import { Venue, Hall, Subscription, SubscriptionPayment } from "../../models/venueModels.js";
import { must, fail } from "../../utils/errors.js";
import { getRazorpay } from "../../config/razorpay.js";
import { transaction, audit } from "../persistenceService.js";
import { syncEnvironmentPlans } from "../subscriptionPlanService.js";
import { subscriptionDurationDays } from "../../config/subscriptionPlans.js";
import { findOrdersByReceipt } from "../subscriptionCheckoutPolicy.js";
import { subscriptionIsActive } from "./accessService.js";
import { validateOrderIdentity } from "./providerValidation.js";
async function checkoutSubscription(venueId, hallId) {
  const hall = await Hall.findOne({ _id: hallId, venueId }).lean();
  must(hall, "Hall not found", 404);
  const venue = await Venue.findOne({ _id: venueId, suspended: false }).lean();
  must(venue, "Venue unavailable", 404);
  must(
    venue.contact?.phone && venue.address?.city && venue.address?.state,
    "Complete venue phone, city and state before payment",
    409,
  );
  const sub = await Subscription.findOne({ venueId, hallId, ownerId: venue.ownerId });
  must(
    sub,
    "Hall subscription not found. Existing data may require the hall subscription migration.",
    409,
  );
  must(
    !["suspended", "review_required"].includes(sub.status),
    "Hall subscription needs platform review",
    403,
  );
  return sub;
}
const snapshotPlan = (plan) => ({
  name: plan.name,
  amount: plan.amount,
  interval: plan.interval,
  durationDays: subscriptionDurationDays(plan),
  features: { publicWebsite: plan.features.publicWebsite, enquiries: plan.features.enquiries },
});
const checkoutResponse = (record) => ({
  orderId: record.razorpayOrderId,
  keyId: process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_ID,
  amount: record.amount,
  currency: record.currency,
  status: record.status,
  plan: record.planSnapshot,
  hallId: record.hallId,
});
export async function persistOrder(subscription, draft, remote, token) {
  const fields = { ...draft, razorpayOrderId: remote.id };
  validateOrderIdentity(remote, fields);
  return transaction(async (session) => {
    const sub = await Subscription.findOne({ _id: subscription._id, checkoutLock: token }).session(
      session,
    );
    must(sub, "Checkout lock changed. Contact support to reconcile this order.", 409);
    let record = await SubscriptionPayment.findOne({ receipt: draft.receipt }).session(session);
    if (!record) {
      [record] = await SubscriptionPayment.create([fields], { session });
    } else
      must(
        record.razorpayOrderId === remote.id,
        "More than one remote order requires support review",
        409,
      );
    sub.checkoutLock = null;
    sub.checkoutDraft = null;
    await sub.save({ session });
    return record;
  });
}
export async function createCheckout(venueId, hallId, planId, gateway = getRazorpay()) {
  const plan = (await syncEnvironmentPlans()).find((plan) => String(plan._id) === String(planId));
  must(plan, "Plan not available", 404);
  const sub = await checkoutSubscription(venueId, hallId);
  must(
    !subscriptionIsActive(sub),
    "Renewal is available after this hall subscription expires.",
    409,
  );
  const pending = await SubscriptionPayment.findOne({
    venueId,
    hallId,
    status: { $in: ["created", "review_required"] },
  }).sort({ createdAt: -1 });
  if (pending) {
    must(
      pending.status === "created" && String(pending.planId) === String(planId),
      "An existing payment needs reconciliation or review before another checkout",
      409,
    );
    return checkoutResponse(pending);
  }
  const token = crypto.randomUUID();
  const draft = {
    ownerId: sub.ownerId,
    venueId: sub.venueId,
    hallId: sub.hallId,
    subscriptionId: sub._id,
    planId: plan._id,
    planSnapshot: snapshotPlan(plan),
    amount: plan.amount,
    currency: "INR",
    receipt: `hs_${crypto.randomUUID().replaceAll("-", "")}`,
  };
  const locked = await Subscription.findOneAndUpdate(
    { _id: sub._id, checkoutLock: null },
    { $set: { checkoutLock: token, checkoutDraft: draft } },
    { returnDocument: "after" },
  );
  must(locked, "A checkout is being created or needs reconciliation. Refresh payment status.", 409);
  if (subscriptionIsActive(locked)) {
    await Subscription.updateOne(
      { _id: sub._id, checkoutLock: token },
      { $set: { checkoutLock: null, checkoutDraft: null } },
    );
    throw fail("The active plan changed. Refresh subscription status before paying.", 409);
  }
  // Recheck after claiming the lock: another process may have just persisted an order.
  const other = await SubscriptionPayment.findOne({
    venueId,
    hallId,
    status: { $in: ["created", "review_required"] },
  });
  if (other) {
    await Subscription.updateOne(
      { _id: sub._id, checkoutLock: token },
      { $set: { checkoutLock: null, checkoutDraft: null } },
    );
    must(
      other.status === "created" && String(other.planId) === String(planId),
      "An existing checkout needs review",
      409,
    );
    return checkoutResponse(other);
  }
  let remote;
  try {
    remote = await gateway.orders.create({
      amount: draft.amount,
      currency: draft.currency,
      receipt: draft.receipt,
      notes: {
        ownerId: String(sub.ownerId),
        venueId: String(venueId),
        hallId: String(hallId),
        subscriptionId: String(sub._id),
        planId: String(plan._id),
        product: "hall_subscription",
      },
    });
  } catch (error) {
    // An uncertain timeout may have created an order. Never silently release its lock.
    if ([400, 401, 403, 404, 422, 429].includes(error.statusCode))
      await Subscription.updateOne(
        { _id: sub._id, checkoutLock: token },
        { $set: { checkoutLock: null, checkoutDraft: null } },
      );
    throw fail(
      "Payment provider could not create checkout. Reconcile status before retrying.",
      502,
    );
  }
  return checkoutResponse(await persistOrder(sub, draft, remote, token));
}
export async function recoverCheckout(venueId, hallId, gateway = getRazorpay()) {
  const sub = await checkoutSubscription(venueId, hallId);
  if (!sub.checkoutLock) return { recovered: false };
  must(sub.checkoutDraft?.receipt, "Checkout needs operator review", 409);
  const orders = await findOrdersByReceipt(gateway, sub.checkoutDraft.receipt);
  must(
    orders.length === 1,
    "No unique remote order found. Keep the lock and request provider reconciliation; do not start another charge.",
    409,
  );
  const draft = JSON.parse(JSON.stringify(sub.checkoutDraft));
  const record = await persistOrder(sub, draft, orders[0], sub.checkoutLock);
  return { recovered: true, order: checkoutResponse(record) };
}
