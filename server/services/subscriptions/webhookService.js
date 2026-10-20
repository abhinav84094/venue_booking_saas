import { Subscription, SubscriptionPayment } from "../../models/venueModels.js";
import { must, fail } from "../../utils/errors.js";
import { getRazorpay } from "../../config/razorpay.js";
import { verifyHmac } from "./providerValidation.js";
import { persistOrder } from "./checkoutService.js";
import { verifySubscriptionPayment, processFinancialEvent } from "./activationService.js";
export async function processSubscriptionWebhook(body, signature) {
  must(Buffer.isBuffer(body), "Raw JSON webhook body required");
  verifyHmac(body, signature, process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET);
  let event;
  try {
    event = JSON.parse(body.toString("utf8"));
  } catch {
    throw fail("Invalid webhook JSON");
  }
  const payment = event.payload?.payment?.entity;
  if (event.event === "payment.captured") {
    must(payment?.order_id && payment?.id, "Invalid payment event");
    let record = await SubscriptionPayment.findOne({ razorpayOrderId: payment.order_id });
    // A provider may have created/captured an order before local persistence
    // completed. Recover only an exact durable draft; never acknowledge and lose
    // a recognized hall payment that still needs reconciliation.
    if (!record) {
      const remote = await getRazorpay().orders.fetch(payment.order_id);
      must(remote?.id === payment.order_id, "Provider order identity mismatch", 503);
      if (remote.notes?.product !== "hall_subscription") return { received: true };
      must(
        ["subscriptionId", "venueId", "hallId", "ownerId"].every(
          (key) =>
            typeof remote.notes[key] === "string" && /^[a-f\d]{24}$/i.test(remote.notes[key]),
        ),
        "Hall payment metadata needs provider reconciliation",
        503,
      );
      const sub = await Subscription.findOne({
        _id: remote.notes.subscriptionId,
        venueId: remote.notes.venueId,
        hallId: remote.notes.hallId,
        ownerId: remote.notes.ownerId,
        "checkoutDraft.receipt": remote.receipt,
      });
      if (sub?.checkoutLock && sub.checkoutDraft)
        record = await persistOrder(
          sub,
          JSON.parse(JSON.stringify(sub.checkoutDraft)),
          remote,
          sub.checkoutLock,
        );
      else record = await SubscriptionPayment.findOne({ razorpayOrderId: payment.order_id });
      must(record, "Captured hall payment needs local reconciliation; retry webhook", 503);
    }
    if (record)
      await verifySubscriptionPayment(record.venueId, record.hallId, {
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
      });
  } else if (event.event === "refund.processed" || event.event?.startsWith("payment.dispute.")) {
    const entity = event.payload?.refund?.entity || event.payload?.dispute?.entity;
    must(entity?.id && entity?.payment_id, "Invalid financial event");
    await processFinancialEvent(event.event, entity.payment_id, `${event.event}:${entity.id}`);
  }
  return { received: true };
}
