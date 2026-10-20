import { Venue, Hall, Booking } from "../models/venueModels.js";
import { transaction, audit } from "./persistenceService.js";
import { requireFeature } from "./subscriptions/accessService.js";
import { must } from "../utils/errors.js";

export async function updateVenueProfile(venueId, input, actorId, hallId) {
  must(Object.keys(input).length, "No updates supplied");
  if (["website", "images", "coverImage"].some((key) => key in input)) {
    must(hallId, "Use an active hall dashboard to manage website content", 402);
    await requireFeature(venueId, hallId, "publicWebsite");
  }
  // Serialize profile edits/publication on the venue document; no client-controlled tenant fields.
  return transaction(async (session) => {
    const current = await Venue.findOneAndUpdate(
      { _id: venueId, suspended: false },
      { $inc: { __v: 1 } },
      { session, returnDocument: "after" },
    );
    must(current, "Venue unavailable", 409);
    if (input.timezone && input.timezone !== current.timezone)
      must(
        !(await Booking.exists({ venueId: current._id }).session(session)),
        "Time zone cannot change after enquiries exist",
        409,
      );
    for (const [key, value] of Object.entries(flattenPatch(input))) current.set(key, value);
    await current.save({ session });
    await audit("venue.updated", current._id, actorId, current._id, session);
    return current;
  });
}

export async function setVenuePublication(source, hallId, published, actorId) {
  if (published) {
    await requireFeature(source._id, hallId, "publicWebsite");
    must(
      source.contact.phone && source.address.city && source.address.state,
      "Add contact phone, city and state before publishing",
    );
    must(
      await Hall.exists({
        venueId: source._id,
        _id: hallId,
        active: true,
        published: true,
        "pricing.0": { $exists: true },
      }),
      "Publish at least one hall with pricing first",
    );
  }
  const venue = await Venue.findOneAndUpdate(
    { _id: source._id, suspended: false },
    { $set: { published } },
    { returnDocument: "after" },
  );
  must(venue, "Venue unavailable", 409);
  await audit(published ? "venue.published" : "venue.unpublished", venue._id, actorId, venue._id);
  return venue;
}

function flattenPatch(input, prefix = "") {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(flattenPatch(value, path))
        : [[path, value]];
    }),
  );
}
