import mongoose from "mongoose";
import { options, ref, image } from "./schemaTypes.js";
const { Schema } = mongoose;
import { validateSlug } from "../../../shared/slug.js";
const venue = new Schema(
  {
    ownerId: ref("User", { immutable: true }),
    name: { type: String, required: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      lowercase: true,
      trim: true,
      validate: (v) => validateSlug(v).valid,
    },
    description: String,
    type: String,
    address: { line1: String, city: String, state: String, postalCode: String },
    contact: { phone: String, whatsapp: String, email: String },
    timezone: { type: String, required: true },
    mapsUrl: String,
    openingHours: String,
    facilities: [String],
    parking: String,
    catering: String,
    decoration: String,
    policies: String,
    images: [image],
    coverImage: String,
    website: {
      headline: String,
      tagline: String,
      accent: String,
      template: { type: String, default: "classic", match: /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/ },
      appearance: { type: String, enum: ["light", "dark", "system"], default: "system" },
      sections: {
        about: { type: Boolean, default: true },
        halls: { type: Boolean, default: true },
        gallery: { type: Boolean, default: true },
        facilities: { type: Boolean, default: true },
        contact: { type: Boolean, default: true },
      },
    },
    published: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    bookingPaymentArrangement: { type: String, enum: ["manual"], default: "manual" },
  },
  options,
);
venue.index({ ownerId: 1, createdAt: -1 });
const membership = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    userId: ref("User", { immutable: true }),
    role: { type: String, enum: ["staff"], default: "staff" },
    permissions: [String],
    active: { type: Boolean, default: true },
  },
  options,
);
membership.index({ venueId: 1, userId: 1 }, { unique: true });
membership.index({ userId: 1, active: 1 });
export const Venue = mongoose.model("Venue", venue);
export const VenueMembership = mongoose.model("VenueMembership", membership);
