import express from "express";
import { rangeSchema } from "../validators/venueValidator.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  requireVenueAccess as access,
  requirePlatformAdmin,
  requireHallContext,
  requireActiveHallSubscription,
} from "../middleware/venueAccessMiddleware.js";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import { uploadSingleImage } from "../middleware/imageUploadMiddleware.js";
import { getAvailability } from "../services/bookingService.js";
import { fail, must } from "../utils/errors.js";
import * as c from "../controllers/venueController.js";
export const venueRoutes = express.Router();
venueRoutes.use(protect);
venueRoutes.get("/slug-availability", apiLimiters.slugAvailability, c.slugAvailability);
venueRoutes.get("/", c.getVenues);
venueRoutes.post("/", c.postVenue);
venueRoutes.get("/:venueId", access("member"), c.getVenue);
venueRoutes.patch("/:venueId", access(), c.patchVenue);
venueRoutes.get("/:venueId/halls", access("member"), c.getHalls);
venueRoutes.post("/:venueId/halls", access(), c.postHall);
const hallRoutes = express.Router({ mergeParams: true });
venueRoutes.use("/:venueId/halls/:hallId", access("member"), requireHallContext, hallRoutes);
hallRoutes.get("/access", c.getHallAccess);
for (const [method, path, controller] of [
  ["get", "/subscription", c.getSubscription],
  ["post", "/subscription/checkout", c.postCheckout],
  ["post", "/subscription/verify", c.postVerify],
  ["post", "/subscription/reconcile", c.postReconcile],
  ["post", "/subscription/recover", c.postRecover],
])
  hallRoutes[method](path, access(), controller);
// Every management endpoint below requires an independently paid, valid hall.
hallRoutes.use(requireActiveHallSubscription);
hallRoutes.get("/", c.getHallAccess);
hallRoutes.patch("/", access(), c.patchHall);
hallRoutes.patch("/venue-profile", access(), c.patchVenue);
hallRoutes.get("/overview", access("overview:read"), c.getDashboard);
hallRoutes.get("/halls", access("halls:read"), c.getHalls);
hallRoutes.patch(
  "/halls/:requestedHallId",
  access(),
  (req, _res, next) => {
    must(String(req.params.requestedHallId) === String(req.hall._id), "Hall not found", 404);
    next();
  },
  c.patchHall,
);
hallRoutes.get("/availability/:availabilityHallId", access("bookings:read"), async (req, res) => {
  must(String(req.params.availabilityHallId) === String(req.hall._id), "Hall not found", 404);
  res.json({
    success: true,
    ...(await getAvailability(req.venue, req.hall._id, rangeSchema.parse(req.query))),
  });
});
hallRoutes.post("/blocks", access("bookings:write"), c.postBlock);
hallRoutes.delete("/blocks/:blockId", access("bookings:write"), c.deleteBlock);
hallRoutes.get("/bookings", access("bookings:read"), c.getBookings);
hallRoutes.patch("/bookings/:bookingId", access("bookings:write"), c.patchBooking);
hallRoutes.get("/customers", access("customers:read"), c.getCustomers);
hallRoutes.post("/customers", access("customers:write"), c.saveCustomer);
hallRoutes.patch("/customers/:customerId", access("customers:write"), c.saveCustomer);
hallRoutes.get("/payments", access("payments:read"), c.getPayments);
hallRoutes.post("/payments", access("payments:write"), c.postPayment);
hallRoutes.post("/booking-checkout", access("payments:write"), () => {
  throw fail(
    "Customer gateway checkout is not configured. Platform subscription credentials cannot collect booking funds.",
    501,
  );
});
hallRoutes.post("/publication", access(), c.publishVenue);
hallRoutes.post("/images", access(), apiLimiters.upload, uploadSingleImage, c.postImage);
hallRoutes.get("/staff", access(), c.getStaff);
hallRoutes.post("/staff", access(), c.postStaff);
hallRoutes.delete("/staff/:membershipId", access(), c.deleteStaff);
// Legacy venue-wide management paths must never expose unpaid sibling halls.
venueRoutes.use("/:venueId", access("member"), () => {
  throw fail("Select a hall and complete its subscription before accessing management", 402);
});
export const adminRoutes = express.Router();
adminRoutes.use(protect, requirePlatformAdmin);
adminRoutes.get("/overview", c.getAdminOverview);
adminRoutes.get("/users", c.getAdminUsers);
adminRoutes.patch("/users/:userId/suspension", c.patchUserSuspension);
adminRoutes.get("/venues", c.getAdminVenues);
adminRoutes.get("/subscriptions", c.getAdminSubscriptions);
adminRoutes.get("/plans", c.getPlans);
adminRoutes.post("/plans", c.postPlan);
adminRoutes.patch("/plans/:planId", c.patchPlan);
adminRoutes.get("/audit", c.getAudit);
