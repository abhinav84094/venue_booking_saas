import { z } from "zod";
import { text, required, money, email, phone } from "./common.js";
export const rangeSchema = z
  .object({ startAt: z.string().min(10).max(40), endAt: z.string().min(10).max(40) })
  .strict();
export const quoteSchema = rangeSchema.extend({
  model: z.enum(["FULL_DAY", "HALF_DAY", "HOURLY", "PACKAGE", "CUSTOM"]),
});
export const enquirySchema = quoteSchema
  .extend({
    hallId: z.string().regex(/^[a-f\d]{24}$/i),
    customer: z.object({ name: required(120), phone, email: email.default("") }).strict(),
    expectedTotalAmount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    eventType: required(100),
    guests: z.number().int().min(1).max(100000),
    notes: text(2000).default(""),
  })
  .strict();
export const blockSchema = rangeSchema.extend({
  hallId: z.string().regex(/^[a-f\d]{24}$/i),
  reason: required(500),
  type: z.enum(["MANUAL", "MAINTENANCE"]).default("MANUAL"),
});
export const paymentSchema = z
  .object({
    bookingId: z.string().regex(/^[a-f\d]{24}$/i),
    amount: money.refine((v) => v > 0, "Enter a positive amount"),
    type: z.enum(["RECEIPT", "REFUND"]),
    method: z.enum(["cash", "bank_transfer", "upi", "other"]),
    reference: required(150),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const bookingStatusSchema = z
  .object({ status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "REJECTED", "CANCELLED"]) })
  .strict();
