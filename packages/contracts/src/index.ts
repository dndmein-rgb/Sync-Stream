import { z } from "zod";

// ─── Server → Client test event (Phase 0 only) ───────────────────────────────
export const ServerHelloSchema = z.object({
  message: z.string(),
  serverTime: z.number(),
  socketId: z.string(),
});
export type ServerHello = z.infer<typeof ServerHelloSchema>;

// ─── Client → Server ping ────────────────────────────────────────────────────
export const ClientPingSchema = z.object({
  clientTime: z.number(),
});
export type ClientPing = z.infer<typeof ClientPingSchema>;



// ─── Room enums / shared ────────────────────────────────────────────

export const RoomVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"])
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>

export const RoomRoleSchema = z.enum(["HOST", "CO_HOST", "VIEWER"]);
export type RoomRole = z.infer<typeof RoomRoleSchema>;



export const RoomMemberViewSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: RoomRoleSchema,
  online: z.boolean(),
  joinedAt: z.iso.datetime().or(z.string()),
})

export type RoomMemberView = z.infer<typeof RoomMemberViewSchema>;

export const RoomViewSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  visibility: RoomVisibilitySchema,
  hostId: z.uuid(),
  maxMembers: z.number().int(),
  memberCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  myRole: RoomRoleSchema.optional(),
});
export type RoomView = z.infer<typeof RoomViewSchema>;


// ─── Socket: client → server ────────────────────────────────────────
export const RoomJoinPayloadSchema = z
  .object({
    roomId: z.uuid().optional(),
    code: z.string().min(4).max(32).optional(),
  })
  .refine((v) => Boolean(v.roomId || v.code), {
    message: "roomId or code is required",
  });

export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;


export const RoomLeavePayloadSchema = z.object({
  roomId: z.uuid(),
  /** If true, also remove DB membership (not only socket presence). */
  leaveMembership: z.boolean().optional().default(false),
});
export type RoomLeavePayload = z.infer<typeof RoomLeavePayloadSchema>;

// ─── Socket: server → client ────────────────────────────────────────
export const RoomMembersPayloadSchema = z.object({
  roomId: z.uuid(),
  members: z.array(RoomMemberViewSchema),
});
export type RoomMembersPayload = z.infer<typeof RoomMembersPayloadSchema>;


export const RoomStatePayloadSchema = z.object({
  room: RoomViewSchema,
  members: z.array(RoomMemberViewSchema),
});
export type RoomStatePayload = z.infer<typeof RoomStatePayloadSchema>;


export const RoomErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  roomId: z.uuid().optional(),
});
export type RoomErrorPayload = z.infer<typeof RoomErrorPayloadSchema>;


export const RoomMemberJoinedPayloadSchema = z.object({
  roomId: z.uuid(),
  member: RoomMemberViewSchema,
});
export type RoomMemberJoinedPayload = z.infer<typeof RoomMemberJoinedPayloadSchema>;

export const RoomMemberLeftPayloadSchema = z.object({
  roomId: z.uuid(),
  userId: z.uuid(),
});
export type RoomMemberLeftPayload = z.infer<typeof RoomMemberLeftPayloadSchema>;

// ──────────────────────────────────────────────
// Phase 3 – Playback synchronization
// ──────────────────────────────────────────────

/**
 * Authoritative playback state owned by the server.
 * Clients never invent this; they only apply what the server broadcasts.
 */

export const PlaybackStatusSchema = z.enum(["PLAYING", "PAUSED"])
export type PlaybackStatus = z.infer<typeof PlaybackStatusSchema>;

export const PlaybackStateSchema = z.object({
  videoId: z.string().min(1),          // for now a direct URL or simple asset id
  status: PlaybackStatusSchema,
  position: z.number().min(0),         // seconds at the moment of updatedAt
  updatedAt: z.number().int(),         // server timestamp in ms
  playbackRate: z.number().positive().default(1),
  sequence: z.number().int().nonnegative(),
});
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;

/**
 * Client → Server command.
 * The server validates, checks permissions, deduplicates by commandId,
 * then produces a new PlaybackState.
 */
export const PlaybackActionSchema = z.enum([
  "PLAY",
  "PAUSE",
  "SEEK",
  "CHANGE_VIDEO",
]);
export type PlaybackAction = z.infer<typeof PlaybackActionSchema>;

export const PlaybackCommandSchema = z
  .object({
    roomId: z.uuid(),
    action: PlaybackActionSchema,
    position: z.number().min(0).optional(),   // required for SEEK, optional for PLAY
    videoId: z.string().min(1).optional(),    // required for CHANGE_VIDEO
    commandId: z.uuid(),             // client-generated, used for dedup
  })
  .superRefine((val, ctx) => {
    if (val.action === "SEEK" && val.position === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "position is required for SEEK",
        path: ["position"],
      });
    }
    if (val.action === "CHANGE_VIDEO" && !val.videoId) {
      ctx.addIssue({
        code: "custom",
        message: "videoId is required for CHANGE_VIDEO",
        path: ["videoId"],
      });
    }
  });
export type PlaybackCommand = z.infer<typeof PlaybackCommandSchema>;

/** Client asks for the current authoritative state (reconnect / late join). */
export const PlaybackSyncPayloadSchema = z.object({
  roomId: z.uuid(),
});
export type PlaybackSyncPayload = z.infer<typeof PlaybackSyncPayloadSchema>;

/** Server → room: the accepted new state after a command. */
export const PlaybackStatePayloadSchema = z.object({
  roomId: z.uuid(),
  state: PlaybackStateSchema,
});
export type PlaybackStatePayload = z.infer<typeof PlaybackStatePayloadSchema>;

/** Server → single client: reply to playback:sync. */
export const PlaybackSnapshotPayloadSchema = z.object({
  roomId: z.uuid(),
  state: PlaybackStateSchema,
});
export type PlaybackSnapshotPayload = z.infer<typeof PlaybackSnapshotPayloadSchema>;

/** Server → client: command rejected or other playback error. */
export const PlaybackErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  roomId: z.uuid().optional(),
  commandId: z.uuid().optional(),
});
export type PlaybackErrorPayload = z.infer<typeof PlaybackErrorPayloadSchema>;

// ─── Typed event map  ────────────────────────────────
export interface ServerToClientEvents {
  "server:hello": (payload: ServerHello) => void;
  "server:pong": (payload: { serverTime: number; clientTime: number }) => void;
  "room:state": (payload: RoomStatePayload) => void;
    "room:members": (payload: RoomMembersPayload) => void;
    "room:member-joined": (payload: RoomMemberJoinedPayload) => void;
    "room:member-left": (payload: RoomMemberLeftPayload) => void;
    "room:error": (payload: RoomErrorPayload) => void;
}

export interface ClientToServerEvents {
  "client:ping": (payload: ClientPing) => void;
  "room:join": (payload: RoomJoinPayload) => void;
    "room:leave": (payload: RoomLeavePayload) => void;
}

export interface InterServerEvents {}

export interface SocketData{
  user?: {
    id: string;
    email: string;
    name: string;
    avatarUrl:string|null
  }
}