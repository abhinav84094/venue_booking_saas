import mongoose from "mongoose";
import User from "../models/User.js";
import { Venue, Subscription, SubscriptionPayment } from "../models/venueModels.js";
import { audit } from "./persistenceService.js";
import { must } from "../utils/errors.js";

export async function getPlatformStats() {
  const [owners, venues, activeSubscriptions, payments] = await Promise.all([
    User.countDocuments({ role: "owner" }),
    Venue.countDocuments(),
    Subscription.countDocuments({
      hallId: { $type: "objectId" },
      status: "active",
      currentPeriodEnd: { $gt: new Date() },
    }),
    SubscriptionPayment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  return { owners, venues, activeSubscriptions, subscriptionRevenue: payments[0]?.total || 0 };
}

export async function setAccountSuspension(userId, suspended, actorId) {
  must(mongoose.isObjectIdOrHexString(userId), "Invalid user ID");
  must(userId !== String(actorId), "You cannot suspend your own account");
  const user = await User.findOneAndUpdate(
    { _id: userId, role: { $ne: "platform_admin" } },
    { $set: { suspended }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  );
  must(user, "Owner/staff account not found", 404);
  await Venue.updateMany({ ownerId: user._id }, { $set: { suspended } });
  await audit(
    suspended ? "account.suspended" : "account.reactivated",
    undefined,
    actorId,
    user._id,
  );
}
