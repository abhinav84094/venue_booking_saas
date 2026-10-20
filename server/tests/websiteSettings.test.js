import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Venue } from "../models/venueModels.js";
import { venueSchema, venueUpdateSchema } from "../validators/venueValidator.js";

test("website templates accept future file IDs while rejecting unsafe identifiers and settings", () => {
  for (const template of ["classic", "editorial", "royal-wedding", "Conference2027_v2"])
    assert.equal(venueUpdateSchema.parse({ website: { template } }).website.template, template);

  for (const template of ["", "../RoyalWedding", "<script>", "royal wedding", "a".repeat(81)])
    assert.equal(venueUpdateSchema.safeParse({ website: { template } }).success, false);
  assert.equal(
    venueUpdateSchema.safeParse({ website: { appearance: "automatic" } }).success,
    false,
  );
  assert.equal(
    venueUpdateSchema.safeParse({ website: { sections: { checkout: false } } }).success,
    false,
  );
  assert.equal(
    venueUpdateSchema.safeParse({ website: { sections: { about: "false" } } }).success,
    false,
  );
});

test("appearance and section PATCH fields never reset an unrelated customization", () => {
  assert.deepEqual(venueUpdateSchema.parse({ website: { sections: { gallery: false } } }), {
    website: { sections: { gallery: false } },
  });
  assert.deepEqual(venueUpdateSchema.parse({ website: { appearance: "dark" } }), {
    website: { appearance: "dark" },
  });
  assert.deepEqual(venueUpdateSchema.parse({ website: { template: "new-template" } }), {
    website: { template: "new-template" },
  });
});

test("existing venue records receive safe website defaults without a data migration", () => {
  const input = venueSchema.parse({ name: "Existing Venue", slug: "existing-venue" });
  const venue = new Venue({ ...input, ownerId: new mongoose.Types.ObjectId() });
  assert.equal(venue.website.template, "classic");
  assert.equal(venue.website.appearance, "system");
  assert.deepEqual(venue.toObject().website.sections, {
    about: true,
    halls: true,
    gallery: true,
    facilities: true,
    contact: true,
  });
  const existing = Venue.hydrate({
    _id: new mongoose.Types.ObjectId(),
    ownerId: new mongoose.Types.ObjectId(),
    name: "Existing Venue",
    slug: "existing-venue",
    timezone: "Asia/Kolkata",
    website: { template: "editorial", headline: "Your special event" },
  });
  assert.equal(existing.website.template, "editorial");
  assert.equal(existing.website.headline, "Your special event");
  assert.equal(existing.website.appearance, "system");
  assert.equal(existing.website.sections.contact, true);
});
