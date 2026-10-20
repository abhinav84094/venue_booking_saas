import { Subscription, SubscriptionPayment } from "../../models/venueModels.js";
import { must, fail } from "../../utils/errors.js";
import { getRazorpay } from "../../config/razorpay.js";
import { transaction, audit } from "../persistenceService.js";
import { subscriptionDurationDays } from "../../config/subscriptionPlans.js";
import { subscriptionIsActive } from "./accessService.js";
import { verifyHmac, validateCapturedPayment } from "./providerValidation.js";
export async function activateCaptured(record, paymentId) {
  return transaction(async (session) => {
    const payment = await SubscriptionPayment.findById(record._id).session(session);
    must(payment, "Payment not found", 404);
    if (payment.status === "paid") {
      must(payment.razorpayPaymentId === paymentId, "Payment identity conflict", 409);
      return { alreadyProcessed: true };
    }
    must(payment.status === "created", "Payment requires financial review", 409);
    const sub = await Subscription.findOne({
      _id: payment.subscriptionId,
      venueId: payment.venueId,
      hallId: payment.hallId,
      ownerId: payment.ownerId,
    }).session(session);
    must(sub, "Subscription not found", 404);
    must(
      !["suspended", "review_required"].includes(sub.status),
      "Subscription needs platform review",
      403,
    );
    const now = new Date(),
      active = subscriptionIsActive(sub, now);
    // Multiple unresolved or late captures must not replace a newer plan.
    if (active) {
      payment.status = "review_required";
      payment.razorpayPaymentId = paymentId;
      payment.reviewReason = "Captured order conflicts with the current subscription";
      await payment.save({ session });
      return { requiresReview: true };
    }
    const end = new Date(now.getTime() + subscriptionDurationDays(payment.planSnapshot) * 86400000);
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = end;
    sub.planId = payment.planId;
    sub.planSnapshot = payment.planSnapshot;
    sub.status = "active";
    sub.activePaymentId = payment._id;
    payment.status = "paid";
    payment.razorpayPaymentId = paymentId;
    payment.paidAt = now;
    await sub.save({ session });
    await payment.save({ session });
    await audit("subscription.activated", payment.venueId, undefined, payment._id, session);
    return { alreadyProcessed: false, status: "active", currentPeriodEnd: end };
  });
}
export async function verifySubscriptionPayment(venueId, hallId, input, gateway = getRazorpay()) {
  const record = await SubscriptionPayment.findOne({
    venueId,
    hallId,
    razorpayOrderId: input.razorpay_order_id,
  });
  must(record, "Subscription order not found", 404);
  if (input.razorpay_signature)
    verifyHmac(
      `${record.razorpayOrderId}|${input.razorpay_payment_id}`,
      input.razorpay_signature,
      process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET,
    );
  must(
    typeof input.razorpay_payment_id === "string" &&
      /^pay_[a-zA-Z0-9]+$/.test(input.razorpay_payment_id),
    "Valid payment ID required",
  );
  const [remote, order] = await Promise.all([
    gateway.payments.fetch(input.razorpay_payment_id),
    gateway.orders.fetch(record.razorpayOrderId),
  ]);
  must(remote.id === input.razorpay_payment_id, "Payment identity mismatch", 409);
  validateCapturedPayment(remote, order, record);
  return activateCaptured(record, remote.id);
}
export async function reconcilePayment(venueId, hallId, orderId, gateway = getRazorpay()) {
  const record = await SubscriptionPayment.findOne({ venueId, hallId, razorpayOrderId: orderId });
  must(record, "Order not found", 404);
  const result = await gateway.orders.fetchPayments(orderId);
  const captured = (result.items || []).filter((p) => p.status === "captured");
  must(
    captured.length === 1,
    "No single captured payment found. Check provider status before retrying.",
    409,
  );
  return verifySubscriptionPayment(
    venueId,
    hallId,
    { razorpay_order_id: orderId, razorpay_payment_id: captured[0].id },
    gateway,
  );
}
export async function processFinancialEvent(event, paymentId, key) {
  return transaction(async (session) => {
    const payment = await SubscriptionPayment.findOne({ razorpayPaymentId: paymentId }).session(
      session,
    );
    if (!payment || payment.financialEventKeys.includes(key)) return;
    payment.financialEventKeys.push(key);
    payment.status = "review_required";
    payment.reviewReason = event;
    await payment.save({ session });
    // Revoke only the period tied to this payment. Newer purchases are preserved.
    await Subscription.updateOne(
      { _id: payment.subscriptionId, activePaymentId: payment._id },
      { $set: { status: "review_required" } },
      { session },
    );
    await audit("subscription.financial_review", payment.venueId, undefined, payment._id, session);
  });
}
