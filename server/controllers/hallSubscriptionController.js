import { Subscription, SubscriptionPayment } from "../models/venueModels.js";
import {
  checkoutSchema,
  paymentVerificationSchema,
  reconciliationSchema,
} from "../validators/venueValidator.js";
import {
  getHallSubscriptionState,
  createCheckout,
  recoverCheckout,
  verifySubscriptionPayment,
  reconcilePayment,
} from "../services/venueSubscriptionService.js";
import { syncEnvironmentPlans } from "../services/subscriptionPlanService.js";

export async function getSubscription(req, res) {
  const [subscription, plans, payments] = await Promise.all([
    getHallSubscriptionState(req.venue._id, req.hall._id),
    syncEnvironmentPlans(),
    SubscriptionPayment.find({ venueId: req.venue._id, hallId: req.hall._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);
  res.json({
    success: true,
    subscription,
    dashboardAccess: subscription.dashboardAccess,
    plans,
    payments,
    mode: "required",
    gatewayConfigured: Boolean(
      process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_ID &&
      process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET,
    ),
    hasUncertainCheckout: Boolean(
      await Subscription.exists({
        venueId: req.venue._id,
        hallId: req.hall._id,
        checkoutLock: { $ne: null },
      }),
    ),
  });
}

export async function postCheckout(req, res) {
  const { planId } = checkoutSchema.parse(req.body);
  res
    .status(201)
    .json({ success: true, order: await createCheckout(req.venue._id, req.hall._id, planId) });
}

export async function postVerify(req, res) {
  const input = paymentVerificationSchema.parse(req.body);
  res.json({
    success: true,
    ...(await verifySubscriptionPayment(req.venue._id, req.hall._id, input)),
  });
}

export async function postReconcile(req, res) {
  const { orderId } = reconciliationSchema.parse(req.body);
  res.json({ success: true, ...(await reconcilePayment(req.venue._id, req.hall._id, orderId)) });
}

export async function postRecover(req, res) {
  res.json({ success: true, ...(await recoverCheckout(req.venue._id, req.hall._id)) });
}
