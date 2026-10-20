import { z } from "zod";
import { required, email, phone } from "./common.js";
export const customerSchema = z
  .object({ name: required(120), phone, email: email.default("") })
  .strict();
export const permissions = [
  "overview:read",
  "halls:read",
  "bookings:read",
  "bookings:write",
  "customers:read",
  "customers:write",
  "payments:read",
  "payments:write",
];
export const staffSchema = z
  .object({ email: z.email(), permissions: z.array(z.enum(permissions)).max(permissions.length) })
  .strict()
  .superRefine((v, ctx) => {
    const rules = {
      "bookings:read": ["halls:read"],
      "bookings:write": ["bookings:read", "halls:read"],
      "customers:write": ["customers:read"],
      "payments:write": ["payments:read", "bookings:read", "halls:read"],
    };
    for (const [scope, needs] of Object.entries(rules))
      if (v.permissions.includes(scope))
        for (const needed of needs)
          if (!v.permissions.includes(needed))
            ctx.addIssue({
              code: "custom",
              path: ["permissions"],
              message: `${scope} requires ${needed}`,
            });
  });

export const suspensionSchema = z.object({ suspended: z.boolean() }).strict();
