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
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(72) })
  .strict();
export const accountSchema = z.object({ name: z.string().trim().min(2).max(100) }).strict();
export const googleChallengeSchema = z
  .object({ purpose: z.enum(["login", "register", "recover"]) })
  .strict();
export const googleCredentialSchema = z
  .object({ credential: z.string().min(1).max(10000) })
  .strict();
export const googlePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().max(72),
  })
  .strict()
  .refine((input) => input.password === input.confirmPassword, "Passwords must match");
export const googleLinkSchema = z.object({ password: z.string().min(1).max(72) }).strict();
