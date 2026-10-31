  import type { Server, Socket } from "socket.io";
  import {
    ChatSendPayloadSchema,
    ChatHistoryPayloadSchema,
    ReactionPayloadSchema,
    TypingPayloadSchema,
    type ClientToServerEvents,
    type ServerToClientEvents,
    type InterServerEvents,
    type SocketData,
  } from "@syncstream/contracts";
  import { AppError } from "@syncstream/shared-utils";
  import { chatService } from "../chat/chat.container.js";
  import { roomService } from "../room/room.container.js";
  import { socketRoomName } from "../room/room.helper.js";
  import { logger } from "../../config/logger.js";
import { metrics } from "../../infrastructure/metrics.js";
  
  type IoServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  type AppSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  
  /** Simple per-socket rate limit: max N events per window. */
  function createRateLimiter(max: number, windowMs: number) {
    const hits = new Map<string, number[]>();
    return (key: string): boolean => {
      const now = Date.now();
      const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (arr.length >= max) {
        hits.set(key, arr);
        return false;
      }
      arr.push(now);
      hits.set(key, arr);
      return true;
    };
  }
  
  const chatRateOk = createRateLimiter(20, 10_000);   // 20 msgs / 10s
  const reactionRateOk = createRateLimiter(30, 10_000);
  const typingRateOk = createRateLimiter(10, 5_000);
  
  function emitChatError(
    socket: AppSocket,
    err: unknown,
    roomId?: string,
    clientMessageId?: string,
  ) {
    metrics.chatMessagesRejected += 1;
    if (err instanceof AppError) {
      socket.emit("chat:error", {
        code: err.code,
        message: err.message,
        roomId,
        clientMessageId,
      });
      return;
    }
    logger.error("chat handler error", { err });
    socket.emit("chat:error", {
      code: "INTERNAL_ERROR",
      message: "Unexpected chat error",
      roomId,
      clientMessageId,
    });
  }
  
  export function registerChatHandlers(io: IoServer, socket: AppSocket) {
    const user = socket.data.user;
    if (!user) return;
  
    // ── send message ────────────────────────────────────────────────────────
    socket.on("chat:send", async (raw) => {
      let roomId: string | undefined;
      let clientMessageId: string | undefined;
      try {
        const parsed = ChatSendPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit("chat:error", {
            code: "BAD_REQUEST",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          });
          return;
        }
        const { roomId: rid, content, clientMessageId: cid } = parsed.data;
        roomId = rid;
        clientMessageId = cid;
  
        if (!chatRateOk(`${socket.id}:chat`)) {
          socket.emit("chat:error", {
            code: "RATE_LIMITED",
            message: "Too many messages; slow down",
            roomId,
            clientMessageId,
          });
          return;
        }
  
        // Persist first
        const view = await chatService.send(user.id, rid, content, cid);
  
        // Then broadcast to the Socket.IO room only
        const channel = socketRoomName(rid);
        io.to(channel).emit("chat:message", view);
        metrics.chatMessagesSent += 1;
        logger.info("chat:send ok", {
          roomId: rid,
          userId: user.id,
          messageId: view.id,
        });
      } catch (err) {
        emitChatError(socket, err, roomId, clientMessageId);
      }
    });
  
    // ── history (on demand / reconnect) ─────────────────────────────────────
    socket.on("chat:history", async (raw) => {
      try {
        const parsed = ChatHistoryPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit("chat:error", {
            code: "BAD_REQUEST",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          });
          return;
        }
        const { roomId, cursor, limit } = parsed.data;
        const result = await chatService.history(user.id, roomId, { cursor, limit });
        socket.emit("chat:history", {
          roomId,
          messages: result.messages,
          nextCursor: result.nextCursor,
        });
      } catch (err) {
        emitChatError(
          socket,
          err,
          typeof raw === "object" && raw && "roomId" in raw
            ? String((raw as { roomId?: string }).roomId)
            : undefined,
        );
      }
    });
  
    // ── reaction (ephemeral) ────────────────────────────────────────────────
    socket.on("reaction:send", async (raw) => {
      try {
        const parsed = ReactionPayloadSchema.safeParse(raw);
        if (!parsed.success) return;
  
        const { roomId, emoji } = parsed.data;
        if (!reactionRateOk(`${socket.id}:reaction`)) return;
  
        await roomService.assertMember(roomId, user.id);
  
        io.to(socketRoomName(roomId)).emit("reaction:new", {
          roomId,
          userId: user.id,
          name: user.name,
          emoji,
          at: Date.now(),
        });
      } catch (err) {
        // silent for reactions – do not spam chat:error
        logger.debug("reaction rejected", { err });
      }
    });
  
    // ── typing (ephemeral) ──────────────────────────────────────────────────
    socket.on("typing:update", async (raw) => {
      try {
        const parsed = TypingPayloadSchema.safeParse(raw);
        if (!parsed.success) return;
  
        const { roomId, isTyping } = parsed.data;
        if (!typingRateOk(`${socket.id}:typing`)) return;
  
        await roomService.assertMember(roomId, user.id);
  
        // do not echo back to sender
        socket.to(socketRoomName(roomId)).emit("typing:update", {
          roomId,
          userId: user.id,
          name: user.name,
          isTyping,
        });
      } catch {
        // ignore
      }
    });
  }