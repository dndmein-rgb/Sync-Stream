import { z } from "zod";

export const RegisterBodySchema = z.object({
  email: z.email().max(320).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;