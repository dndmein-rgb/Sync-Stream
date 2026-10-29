import { z } from "zod";

export const CreateRoomBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).optional().default("PRIVATE"),
  maxMembers: z.coerce.number().int().min(2).max(50).optional().default(10),
});
export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

export const UpdateRoomBodySchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    visibility: z.enum(["PRIVATE", "PUBLIC"]).optional(),
    maxMembers: z.coerce.number().int().min(2).max(50).optional(),
  })
  .refine((v) => v.name !== undefined || v.visibility !== undefined || v.maxMembers !== undefined, {
    message: "At least one field is required",
  });
export type UpdateRoomBody = z.infer<typeof UpdateRoomBodySchema>;

export const RoomIdParamsSchema = z.object({
  id: z.uuid(),
});
export type RoomIdParams = z.infer<typeof RoomIdParamsSchema>;

export const JoinByCodeBodySchema = z.object({
  code: z.string().min(4).max(32).transform((c) => c.trim().toUpperCase()),
});
export type JoinByCodeBody = z.infer<typeof JoinByCodeBodySchema>;

export const JoinByIdBodySchema = z.object({
  code: z
    .string()
    .min(4)
    .max(32)
    .transform((c) => c.trim().toUpperCase())
    .optional(),
});
export type JoinByIdBody = z.infer<typeof JoinByIdBodySchema>;