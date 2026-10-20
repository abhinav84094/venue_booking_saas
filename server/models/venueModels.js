// Compatibility entry point; schemas are grouped by business aggregate.
import { Venue, VenueMembership } from "./venue/venueModels.js";
import { Hall } from "./venue/hallModel.js";
import { Customer, Booking, AvailabilityBlock, Payment } from "./venue/bookingModels.js";
import { SubscriptionPlan, Subscription, SubscriptionPayment } from "./venue/subscriptionModels.js";
import { AuditLog } from "./venue/auditModel.js";
export {
  Venue,
  VenueMembership,
  Hall,
  Customer,
  Booking,
  AvailabilityBlock,
  Payment,
  SubscriptionPlan,
  Subscription,
  SubscriptionPayment,
  AuditLog,
};
export const initializeIndexes = () =>
  Promise.all(
    [
      Venue,
      VenueMembership,
      Hall,
      Customer,
      Booking,
      AvailabilityBlock,
      Payment,
      SubscriptionPlan,
      Subscription,
      SubscriptionPayment,
      AuditLog,
    ].map((m) => m.init()),
  );
