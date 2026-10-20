import { z } from "zod";
export const text = (max = 200) => z.string().trim().max(max);
export const required = (max = 200) => text(max).min(2);
export const money = z.number().int().min(0).max(100_000_000_000);
export const url = z.union([
  z.literal(""),
  z.url().refine((v) => new URL(v).protocol === "https:", "Use an HTTPS URL"),
]);
export const email = z.union([z.literal(""), z.email().max(254)]);
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }, "Phone numbers must contain 7–15 digits");
export const imageSchema = z
  .object({
    url: z.url().refine((v) => new URL(v).protocol === "https:", "Use an HTTPS image"),
    alt: text(200).default(""),
  })
  .strict();
// Zod 4 applies defaults even inside optional fields. PATCH must never invent
// values for omitted keys, including nested contact/address/feature fields.
export function patchObject(schema) {
  return z
    .object(
      Object.fromEntries(
        Object.entries(schema.shape).map(([key, field]) => {
          const raw = field instanceof z.ZodDefault ? field.removeDefault() : field;
          return [key, (raw instanceof z.ZodObject ? patchObject(raw) : raw).optional()];
        }),
      ),
    )
    .strict();
}
