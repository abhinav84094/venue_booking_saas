// Public compatibility boundary. Payment logic lives in focused services.
export {
  subscriptionIsActive,
  hasVerifiedPayment,
  getHallSubscriptionState,
  requireHallEntitlement,
  requireFeature,
} from "./subscriptions/accessService.js";
export {
  verifyHmac,
  validateOrderIdentity,
  validateCapturedPayment,
} from "./subscriptions/providerValidation.js";
export { createCheckout, recoverCheckout } from "./subscriptions/checkoutService.js";
export {
  activateCaptured,
  verifySubscriptionPayment,
  reconcilePayment,
  processFinancialEvent,
} from "./subscriptions/activationService.js";
export { handleSubscriptionWebhook } from "../controllers/subscriptionWebhookController.js";
