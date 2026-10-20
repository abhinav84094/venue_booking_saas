import { Hall } from "../models/venueModels.js";
import { hallCreationSchema, hallUpdateSchema } from "../validators/venueValidator.js";
import { createHall } from "../services/hallService.js";
import { updateHall, getOverview } from "../services/venueService.js";
import { expireEnquiries } from "../services/bookingService.js";
import { getHallSubscriptionState } from "../services/subscriptions/accessService.js";

export async function getHalls(req, res) {
  const halls = await Hall.find({
    venueId: req.venue._id,
    ...(req.hall ? { _id: req.hall._id } : {}),
  })
    .sort({ createdAt: 1 })
    .lean();
  res.json({
    success: true,
    halls: await Promise.all(
      halls.map(async (h) => {
        const subscription = await getHallSubscriptionState(req.venue._id, h._id);
        return {
          ...(subscription.dashboardAccess &&
          (req.isVenueOwner || req.venueMembership?.permissions.includes("halls:read"))
            ? h
            : { _id: h._id, name: h.name, active: h.active, published: h.published }),
          subscription,
        };
      }),
    ),
  });
}

export async function getHallAccess(req, res) {
  const subscription = await getHallSubscriptionState(req.venue._id, req.hall._id);
  res.json({
    success: true,
    venue: req.venue,
    hall: { _id: req.hall._id, name: req.hall.name },
    subscription,
    dashboardAccess: subscription.dashboardAccess,
    access: {
      role: req.isVenueOwner ? "owner" : "staff",
      permissions: req.isVenueOwner ? ["*"] : req.venueMembership.permissions,
    },
  });
}

export async function postHall(req, res) {
  const hall = await createHall(req.venue, hallCreationSchema.parse(req.body), req.user._id);
  res.status(201).json({ success: true, hall });
}

export async function patchHall(req, res) {
  res.json({
    success: true,
    hall: await updateHall(
      req.venue._id,
      req.hall._id,
      hallUpdateSchema.parse(req.body),
      req.user._id,
    ),
  });
}

export async function getDashboard(req, res) {
  await expireEnquiries(req.venue._id, req.hall._id);
  res.json({ success: true, ...(await getOverview(req.venue._id, req.hall._id)) });
}
