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

// ─── Typed event map (extend in later phases) ────────────────────────────────
export interface ServerToClientEvents {
  "server:hello": (payload: ServerHello) => void;
  "server:pong": (payload: { serverTime: number; clientTime: number }) => void;
}

export interface ClientToServerEvents {
  "client:ping": (payload: ClientPing) => void;
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