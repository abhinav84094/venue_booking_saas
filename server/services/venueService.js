import { Venue, VenueMembership, Hall, Booking, Customer, Payment } from "../models/venueModels.js";
import { transaction, audit, lockHall, bookingPaymentState } from "./bookingService.js";
import { getHallSubscriptionState } from "./venueSubscriptionService.js";
import { must } from "../utils/errors.js";
export async function createVenue(ownerId, input) {
  return transaction(async (session) => {
    const [venue] = await Venue.create([{ ...input, ownerId }], { session });
    await audit("venue.created", venue._id, ownerId, venue._id, session);
    return venue;
  });
}
export async function listVenues(userId) {
  const memberships = await VenueMembership.find({ userId, active: true }).lean();
  const venues = await Venue.find({
    $or: [{ ownerId: userId }, { _id: { $in: memberships.map((m) => m.venueId) } }],
  })
    .sort({ createdAt: -1 })
    .lean();
  return Promise.all(
    venues.map(async (v) => ({
      ...v,
      halls: await Promise.all(
        (
          await Hall.find({ venueId: v._id })
            .select("name active published")
            .sort({ createdAt: 1 })
            .lean()
        ).map(async (h) => {
          const subscription = await getHallSubscriptionState(v._id, h._id);
          if (v.suspended) {
            subscription.status = "suspended";
            subscription.dashboardAccess = false;
          }
          return { ...h, subscription };
        }),
      ),
      access:
        String(v.ownerId) === String(userId)
          ? { role: "owner", permissions: ["*"] }
          : {
              role: "staff",
              permissions: memberships.find((m) => String(m.venueId) === String(v._id)).permissions,
            },
    })),
  );
}
export async function updateHall(venueId, hallId, input, actorId) {
  return transaction(async (session) => {
    const hall = await lockHall(venueId, hallId, session);
    Object.assign(hall, input);
    must(
      !hall.published || hall.pricing.length > 0,
      "Configure pricing before publishing this hall",
    );
    await hall.save({ session });
    await audit("hall.updated", venueId, actorId, hall._id, session);
    return hall;
  });
}
export async function getOverview(venueId, hallId) {
  const scope = { venueId, hallId };
  const now = new Date();
  const [
    totalHalls,
    pendingEnquiries,
    confirmedBookings,
    upcomingEvents,
    totalCustomers,
    revenue,
    upcoming,
  ] = await Promise.all([
    Hall.countDocuments({ venueId, _id: hallId }),
    Booking.countDocuments({
      ...scope,
      status: { $in: ["ENQUIRY", "PENDING"] },
      enquiryExpiresAt: { $gt: now },
    }),
    Booking.countDocuments({ ...scope, status: "CONFIRMED" }),
    Booking.countDocuments({ ...scope, status: "CONFIRMED", startAt: { $gte: now } }),
    Customer.countDocuments(scope),
    Payment.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [{ $eq: ["$type", "REFUND"] }, { $multiply: ["$amount", -1] }, "$amount"],
            },
          },
        },
      },
    ]),
    Booking.find({ ...scope, status: "CONFIRMED", startAt: { $gte: now } })
      .sort({ startAt: 1 })
      .limit(6)
      .populate("hallId", "name")
      .populate("customerId", "name phone")
      .lean(),
  ]);
  return {
    stats: {
      totalHalls,
      pendingEnquiries,
      confirmedBookings,
      upcomingEvents,
      totalCustomers,
      recordedRevenue: revenue[0]?.total || 0,
    },
    upcoming: upcoming.map((v) => ({ ...v, paymentState: bookingPaymentState(v) })),
  };
}
export const publicVenueFields =
  "name slug description type address contact timezone mapsUrl openingHours facilities parking catering decoration policies images coverImage website";
export const publicHallFields = "name description capacity images facilities pricing";
