import mongoose from "mongoose";
import { Venue, VenueMembership, Hall } from "../models/venueModels.js";
import { requireHallEntitlement } from "../services/venueSubscriptionService.js";
import { must } from "../utils/errors.js";

export function requireVenueAccess(permission = "owner") {
  return async (req, _res, next) => {
    try {
      must(mongoose.isObjectIdOrHexString(req.params.venueId), "Invalid venue ID");
      const venue = await Venue.findById(req.params.venueId);
      must(venue, "Venue not found", 404);
      const isOwner = String(venue.ownerId) === String(req.user._id);
      if (!isOwner) {
        const membership = await VenueMembership.findOne({
          venueId: venue._id,
          userId: req.user._id,
          active: true,
        }).lean();
        must(
          permission !== "owner" &&
            (permission === "member"
              ? Boolean(membership)
              : membership?.permissions.includes(permission)),
          "Venue not found or access denied",
          404,
        );
        req.venueMembership = membership;
      }
      must(!venue.suspended, "Venue access is suspended", 403);
      req.venue = venue;
      req.isVenueOwner = isOwner;
      next();
    } catch (error) {
      next(error);
    }
  };
}
export async function requireHallContext(req, _res, next) {
  try {
    must(mongoose.isObjectIdOrHexString(req.params.hallId), "Invalid hall ID");
    const hall = await Hall.findOne({ _id: req.params.hallId, venueId: req.venue._id });
    must(hall, "Hall not found", 404);
    req.hall = hall;
    next();
  } catch (error) {
    next(error);
  }
}
export async function requireActiveHallSubscription(req, _res, next) {
  try {
    req.hallSubscription = await requireHallEntitlement(req.venue._id, req.hall._id);
    next();
  } catch (error) {
    next(error);
  }
}
export const requirePlatformAdmin = (req, _res, next) => {
  try {
    must(req.user.role === "platform_admin", "Platform administrator access required", 403);
    next();
  } catch (error) {
    next(error);
  }
};
