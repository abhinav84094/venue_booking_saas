import express from "express";
import { Venue, Booking } from "../models/venueModels.js";
import crypto from "node:crypto";
import { z } from "zod";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import { rangeSchema, quoteSchema, enquirySchema } from "../validators/venueValidator.js";
import { calculateQuote } from "../services/pricingService.js";
import { createEnquiry, getAvailability } from "../services/bookingService.js";
import { requireFeature } from "../services/venueSubscriptionService.js";
import {
  getPublicVenue,
  resolvePublicHall,
  resolvePublicVenue,
  slugFromHost,
} from "../services/publicVenueService.js";
import { must } from "../utils/errors.js";
const router = express.Router();
router.use("/:slug", (req, _res, next) => {
  try {
    const hostSlug = slugFromHost(req.hostname);
    must(!hostSlug || hostSlug === req.params.slug, "Venue hostname mismatch", 404);
    next();
  } catch (e) {
    next(e);
  }
});
router.get("/:slug", apiLimiters.publicVenue, async (req, res) =>
  res.json({ success: true, ...(await getPublicVenue(req.params.slug)) }),
);
// A guest can retrieve only their receipt, using a separately issued 256-bit
// capability. It is sent in a JSON body, never in a URL or stored in plain text.
router.post("/:slug/enquiries/status", apiLimiters.publicAvailability, async (req, res) => {
  const { reference, token } = z
    .object({
      reference: z.string().regex(/^VB-[A-F0-9]{16}$/),
      token: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .parse(req.body);
  const venue = await Venue.findOne({ slug: req.params.slug }).select("_id").lean();
  must(venue, "Enquiry receipt not found", 404);
  const booking = await Booking.findOne({
    venueId: venue._id,
    reference,
    statusTokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    endAt: { $gte: new Date(Date.now() - 30 * 86400000) },
  })
    .populate("hallId", "name")
    .lean();
  must(booking, "Enquiry receipt not found or access expired", 404);
  const expired =
    ["ENQUIRY", "PENDING"].includes(booking.status) && booking.enquiryExpiresAt <= new Date();
  res.json({
    success: true,
    receipt: {
      reference: booking.reference,
      status: expired ? "EXPIRED" : booking.status,
      hallName: booking.hallId?.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      pricingSnapshot: booking.pricingSnapshot,
      enquiryExpiresAt: booking.enquiryExpiresAt,
    },
  });
});
router.get(
  "/:slug/halls/:hallId/availability",
  apiLimiters.publicAvailability,
  async (req, res) => {
    const venue = await resolvePublicVenue(req.params.slug);
    const hall = await resolvePublicHall(venue._id, req.params.hallId);
    await requireFeature(venue._id, hall._id, "enquiries");
    res.json({
      success: true,
      ...(await getAvailability(venue, hall._id, rangeSchema.parse(req.query), {
        isPublic: true,
      })),
    });
  },
);
router.post("/:slug/halls/:hallId/quote", apiLimiters.publicAvailability, async (req, res) => {
  const venue = await resolvePublicVenue(req.params.slug),
    hall = await resolvePublicHall(venue._id, req.params.hallId);
  await requireFeature(venue._id, hall._id, "publicWebsite");
  await requireFeature(venue._id, hall._id, "enquiries");
  res.json({
    success: true,
    quote: calculateQuote(hall, quoteSchema.parse(req.body), venue.timezone),
  });
});
router.post("/:slug/enquiries", apiLimiters.enquiry, async (req, res) => {
  const venue = await resolvePublicVenue(req.params.slug);
  const input = enquirySchema.parse(req.body);
  const hall = await resolvePublicHall(venue._id, input.hallId);
  await requireFeature(venue._id, hall._id, "enquiries");
  res.status(201).json({ success: true, enquiry: await createEnquiry(venue, input) });
});
export default router;
