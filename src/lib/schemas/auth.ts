import { z } from "zod";

/** Shared password policy: min 8 chars, at least one letter and one number. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const acceptInviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  password: passwordSchema,
  locale: z.enum(["sk", "en"]).default("sk"),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const createMemberInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  locale: z.enum(["sk", "en"]).default("sk"),
});
export type CreateMemberInviteInput = z.infer<typeof createMemberInviteSchema>;
