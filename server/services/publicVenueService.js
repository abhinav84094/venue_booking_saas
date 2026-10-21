import { Venue, Hall, Subscription } from "../models/venueModels.js";
import { publicVenueFields, publicHallFields } from "./venueService.js";
import { hasVerifiedPayment, subscriptionIsActive } from "./venueSubscriptionService.js";
import { validateSlug } from "../../shared/slug.js";
import { must } from "../utils/errors.js";
export function slugFromHost(hostname) {
  const base = process.env.PUBLIC_VENUE_DOMAIN?.trim().toLowerCase(),
    host = String(hostname || "").toLowerCase();
  if (!base || !host.endsWith(`.${base}`)) return null;
  const slug = host.slice(0, -base.length - 1);
  return validateSlug(slug).valid ? slug : null;
}
export async function resolvePublicVenue(slug) {
  must(validateSlug(slug).valid, "Venue not found", 404);
  const venue = await Venue.findOne({ slug, published: true, suspended: false })
    .select(publicVenueFields)
    .lean();
  must(venue, "Venue not found or not published", 404);
  return venue;
}
export async function resolvePublicHall(venueId, hallId) {
  must(typeof hallId === "string" && /^[a-f\d]{24}$/i.test(hallId), "Hall not found", 404);
  const hall = await Hall.findOne({ _id: hallId, venueId, active: true, published: true });
  must(hall, "Hall not found", 404);
  return hall;
}
export async function getPublicVenue(slug) {
  const venue = await resolvePublicVenue(slug);
  // Preserve published venue information after expiry. A never-paid
  // sibling hall is not published by another hall's entitlement.
  const subscriptions = await Subscription.find({
    venueId: venue._id,
    status: { $in: ["active", "expired"] },
    "planSnapshot.features.publicWebsite": true,
  }).lean();
  const visible = (
    await Promise.all(
      subscriptions.map(async (sub) => ((await hasVerifiedPayment(sub)) ? sub : null)),
    )
  ).filter(Boolean);
  const halls = await Hall.find({
    venueId: venue._id,
    active: true,
    published: true,
    _id: { $in: visible.map((sub) => sub.hallId) },
  })
    .select(publicHallFields)
    .lean();
  return {
    venue,
    halls: halls.map((hall) => {
      const sub = visible.find((item) => String(item.hallId) === String(hall._id));
      return {
        ...hall,
        enquiriesEnabled:
          subscriptionIsActive(sub) && sub.planSnapshot?.features?.enquiries === true,
      };
    }),
  };
}
