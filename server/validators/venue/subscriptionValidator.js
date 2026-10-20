import { z } from "zod";
import { required, money, patchObject } from "./common.js";
export const planSchema = z
  .object({
    name: required(100),
    code: z.string().regex(/^[a-z0-9-]{3,40}$/),
    amount: money.refine((v) => v > 0),
    currency: z.literal("INR").default("INR"),
    interval: z.enum(["quarterly", "yearly"]),
    active: z.boolean().default(true),
    features: z.object({ publicWebsite: z.boolean(), enquiries: z.boolean() }).strict(),
  })
  .strict();
export const planUpdateSchema = patchObject(planSchema);
export const checkoutSchema = z.object({ planId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
export const paymentVerificationSchema = z
  .object({
    razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
    razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
    razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();
export const reconciliationSchema = z
  .object({ orderId: z.string().regex(/^order_[A-Za-z0-9]+$/) })
  .strict();
