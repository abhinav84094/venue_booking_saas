import { z } from "zod";
import { text, required, money, imageSchema, patchObject } from "./common.js";
const day = z.iso.date();
export const rateSchema = z
  .object({
    key: z.enum(["FULL_DAY", "HALF_DAY", "HOURLY", "PACKAGE", "CUSTOM"]),
    label: required(80),
    amount: money,
    durationMinutes: z.number().int().min(15).max(10080),
    weekendAmount: money.nullable().default(null),
    overrides: z
      .array(
        z
          .object({ startDate: day, endDate: day, amount: money })
          .strict()
          .refine((v) => v.endDate >= v.startDate, "End date must follow start date"),
      )
      .max(50)
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const sorted = [...v.overrides].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.some((r, i) => i && r.startDate <= sorted[i - 1].endDate))
      ctx.addIssue({
        code: "custom",
        message: "Date overrides must not overlap",
        path: ["overrides"],
      });
  });
export const hallSchema = z
  .object({
    name: required(120),
    description: text(3000).default(""),
    capacity: z.number().int().min(1).max(100000),
    images: z.array(imageSchema).max(30).default([]),
    facilities: z.array(required(80)).max(40).default([]),
    active: z.boolean().default(true),
    published: z.boolean().default(false),
    pricing: z
      .array(rateSchema)
      .max(5)
      .default([])
      .refine(
        (v) => new Set(v.map((r) => r.key)).size === v.length,
        "Enable each pricing model once",
      ),
  })
  .strict();
export const hallUpdateSchema = patchObject(hallSchema);
export const hallCreationSchema = z
  .object({ name: required(120), capacity: z.number().int().min(1).max(100000) })
  .strict();
