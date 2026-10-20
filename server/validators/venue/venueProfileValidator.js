import { z } from "zod";
import { text, required, url, email, phone, imageSchema, patchObject } from "./common.js";
import { IANAZone } from "luxon";
import { validateSlug } from "../../../shared/slug.js";
export const venueSchema = z
  .object({
    name: required(150),
    slug: text(63)
      .transform((v) => v.toLowerCase())
      .refine(
        (v) => validateSlug(v).valid,
        "Use an available, non-reserved slug of 3–63 lowercase letters, numbers and hyphens",
      ),
    description: text(5000).default(""),
    type: z
      .enum(["banquet", "marriage_hall", "party_hall", "resort", "hotel", "conference", "other"])
      .default("banquet"),
    address: z
      .object({
        line1: text(200).default(""),
        city: text(100).default(""),
        state: text(100).default(""),
        postalCode: text(20).default(""),
      })
      .strict()
      .default({}),
    contact: z
      .object({
        phone: z.union([z.literal(""), phone]).default(""),
        whatsapp: z.union([z.literal(""), phone]).default(""),
        email: email.default(""),
      })
      .strict()
      .default({}),
    timezone: text(80)
      .refine((v) => IANAZone.isValidZone(v), "Use an IANA time zone")
      .default("Asia/Kolkata"),
    mapsUrl: url
      .refine(
        (v) =>
          !v ||
          ["www.google.com", "maps.google.com", "maps.app.goo.gl", "google.com"].includes(
            new URL(v).hostname,
          ),
        "Use a Google Maps link",
      )
      .default(""),
    openingHours: text(500).default(""),
    facilities: z.array(required(80)).max(40).default([]),
    parking: text(500).default(""),
    catering: text(1000).default(""),
    decoration: text(1000).default(""),
    policies: text(5000).default(""),
    images: z.array(imageSchema).max(40).default([]),
    coverImage: url.default(""),
    website: z
      .object({
        headline: text(200).default(""),
        tagline: text(500).default(""),
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#876d46"),
        // Template files are discovered by the frontend; additions need no API release.
        template: z
          .string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/)
          .default("classic"),
        appearance: z.enum(["light", "dark", "system"]).default("system"),
        sections: z
          .object({
            about: z.boolean().default(true),
            halls: z.boolean().default(true),
            gallery: z.boolean().default(true),
            facilities: z.boolean().default(true),
            contact: z.boolean().default(true),
          })
          .strict()
          .default({}),
      })
      .strict()
      .default({}),
  })
  .strict();
export const venueUpdateSchema = patchObject(venueSchema.omit({ slug: true }));
export const publicationSchema = z.object({ published: z.boolean() }).strict();
