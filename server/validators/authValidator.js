import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must fit within 72 UTF-8 bytes",
  );
export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
export const emailRequestSchema = z.object({ email: emailSchema }).strict();
export const codeSchema = z
  .object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(72) })
  .strict();
export const passwordResetSchema = codeSchema.extend({ newPassword: passwordSchema }).strict();
export const accountSchema = z.object({ name: z.string().trim().min(2).max(100) }).strict();

export const googleSignupSchema = z
  .object({
    credential: z.unknown(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((input) => input.password === input.confirmPassword, "Passwords must match");
