import { readEnvironmentPlans } from "../config/subscriptionPlans.js";
import { SubscriptionPlan } from "../models/venueModels.js";

// Stable plan IDs bind provider orders to database records. The environment is
// authoritative for new purchases; existing payment/entitlement snapshots survive.
export async function syncEnvironmentPlans() {
  const configured = readEnvironmentPlans();
  const plans = [];
  for (const plan of configured) {
    const options = { upsert: true, returnDocument: "after", runValidators: true };
    try {
      plans.push(
        await SubscriptionPlan.findOneAndUpdate(
          { code: plan.code },
          { $set: plan },
          options,
        ).lean(),
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      plans.push(
        await SubscriptionPlan.findOneAndUpdate(
          { code: plan.code },
          { $set: plan },
          { ...options, upsert: false },
        ).lean(),
      );
    }
  }
  return plans;
}
