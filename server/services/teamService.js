import User from "../models/User.js";
import { VenueMembership } from "../models/venueModels.js";
import { audit } from "./persistenceService.js";
import { must } from "../utils/errors.js";

export async function assignStaff(venue, input, actorId) {
  const user = await User.findOne({
    email: input.email.toLowerCase(),
    emailVerified: true,
    suspended: false,
  });
  must(user, "Staff member must first register and verify an account", 404);
  must(String(user._id) !== String(venue.ownerId), "The venue owner already has access");
  const membership = await VenueMembership.findOneAndUpdate(
    { venueId: venue._id, userId: user._id },
    { $set: { permissions: [...new Set(input.permissions)], active: true } },
    { upsert: true, returnDocument: "after" },
  );
  await audit("staff.permissions_updated", venue._id, actorId, membership._id);
  return membership;
}

export async function revokeStaff(venueId, membershipId, actorId) {
  await VenueMembership.updateOne(
    { _id: membershipId, venueId: venueId },
    { $set: { active: false, permissions: [] } },
  );
  await audit("staff.removed", venueId, actorId, membershipId);
}
