import crypto from "node:crypto";
import { must } from "../../utils/errors.js";
export function verifyHmac(body, signature, secret) {
  must(secret, "Payment verification is not configured", 503);
  must(
    typeof signature === "string" && /^[a-f0-9]{64}$/i.test(signature),
    "Invalid payment signature",
    400,
  );
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  must(
    crypto.timingSafeEqual(Buffer.from(signature, "hex"), expected),
    "Invalid payment signature",
    400,
  );
}
export function validateOrderIdentity(remote, record) {
  must(
    remote.id === record.razorpayOrderId &&
      remote.amount === record.amount &&
      remote.currency === record.currency &&
      remote.receipt === record.receipt &&
      String(remote.notes?.venueId) === String(record.venueId) &&
      String(remote.notes?.hallId) === String(record.hallId) &&
      String(remote.notes?.ownerId) === String(record.ownerId) &&
      String(remote.notes?.subscriptionId) === String(record.subscriptionId) &&
      String(remote.notes?.planId) === String(record.planId) &&
      remote.notes?.product === "hall_subscription",
    "Provider order identity mismatch",
    409,
  );
}
export function validateCapturedPayment(remote, order, record) {
  validateOrderIdentity(order, record);
  must(
    remote.id &&
      remote.order_id === record.razorpayOrderId &&
      remote.amount === record.amount &&
      remote.currency === record.currency &&
      remote.status === "captured" &&
      !remote.amount_refunded &&
      order.status === "paid",
    "Payment is not captured in full for this order",
    409,
  );
}
