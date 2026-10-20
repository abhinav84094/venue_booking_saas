import { Venue } from "../models/venueModels.js";
import { venueSchema, venueUpdateSchema, publicationSchema } from "../validators/venueValidator.js";
import { createVenue, listVenues } from "../services/venueService.js";
import { updateVenueProfile, setVenuePublication } from "../services/venueProfileService.js";
import { validateSlug } from "../../shared/slug.js";
import { must } from "../utils/errors.js";

export async function slugAvailability(req, res) {
  const v = validateSlug(req.query.slug);
  res.json({
    success: true,
    slug: v.slug,
    available: v.valid && !(await Venue.exists({ slug: v.slug })),
    message: v.reason,
  });
}

export async function getVenues(req, res) {
  res.json({ success: true, venues: await listVenues(req.user._id) });
}

export async function postVenue(req, res) {
  must(req.user.role === "owner", "Only venue owners can create venues", 403);
  const venue = await createVenue(req.user._id, venueSchema.parse(req.body));
  res.status(201).json({ success: true, venue });
}

export const getVenue = (req, res) =>
  res.json({
    success: true,
    venue: req.venue,
    access: {
      role: req.isVenueOwner ? "owner" : "staff",
      permissions: req.isVenueOwner ? ["*"] : req.venueMembership.permissions,
    },
  });

export async function patchVenue(req, res) {
  const venue = await updateVenueProfile(
    req.venue._id,
    venueUpdateSchema.parse(req.body),
    req.user._id,
    req.hall?._id,
  );
  res.json({ success: true, venue });
}

export async function publishVenue(req, res) {
  const { published } = publicationSchema.parse(req.body);
  const venue = await setVenuePublication(req.venue, req.hall._id, published, req.user._id);
  res.json({ success: true, venue });
}
