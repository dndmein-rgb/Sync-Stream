import type { Server, Socket } from "socket.io";
import {
  RoomJoinPayloadSchema,
  RoomLeavePayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type InterServerEvents,
  type SocketData,
} from "@syncstream/contracts";
import { AppError } from "@syncstream/shared-utils";
import { roomService } from "../modules/room/room.container.js";
import { socketRoomName } from "../modules/room/room.helper.js";
import { roomPresence } from "./room-presence.js";
import { logger } from "../config/logger.js";

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

function emitRoomError(socket: AppSocket, err: unknown, roomId?: string) {
  if (err instanceof AppError) {
    socket.emit("room:error", {
      code: err.code,
      message: err.message,
      roomId,
    });
    return;
  }
  logger.error({ err }, "room handler error");
  socket.emit("room:error", {
    code: "INTERNAL_ERROR",
    message: "Unexpected room error",
    roomId,
  });
}

export function registerRoomHandlers(io: IoServer, socket: AppSocket) {
  const user = socket.data.user;
  if (!user) return;

  socket.on("room:join", async (raw) => {
    try {
      const parsed = RoomJoinPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit("room:error", {
          code: "BAD_REQUEST",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        });
        return;
      }

      const result = await roomService.join(user.id, {
        roomId: parsed.data.roomId,
        code: parsed.data.code,
      });

      const roomId = result.room.id;
      const channel = socketRoomName(roomId);

      socket.join(channel);
      roomPresence.add(roomId, user.id, socket.id);

      // Refresh members with presence
      const members = await roomService.buildMemberList(roomId);

      socket.emit("room:state", {
        room: result.room,
        members,
      });

      socket.emit("room:members", { roomId, members });

      if (result.created) {
        const me = members.find((m) => m.userId === user.id);
        if (me) {
          socket.to(channel).emit("room:member-joined", {
            roomId,
            member: me,
          });
        }
        socket.to(channel).emit("room:members", { roomId, members });
      } else {
        // Reconnect / second tab: broadcast updated online flags
        socket.to(channel).emit("room:members", { roomId, members });
      }

      logger.info("room:join ok", {
        roomId,
        userId: user.id,
        socketId: socket.id,
        created: result.created,
      });
    } catch (err) {
      emitRoomError(socket, err, typeof raw === "object" && raw && "roomId" in raw
        ? String((raw as { roomId?: string }).roomId)
        : undefined);
    }
  });

  socket.on("room:leave", async (raw) => {
    try {
      const parsed = RoomLeavePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit("room:error", {
          code: "BAD_REQUEST",
          message: "Invalid leave payload",
        });
        return;
      }

      const { roomId, leaveMembership } = parsed.data;
      const channel = socketRoomName(roomId);

      socket.leave(channel);
      const wentOffline = roomPresence.remove(roomId, user.id, socket.id);

      if (leaveMembership) {
        await roomService.leave(user.id, roomId);
        io.to(channel).emit("room:member-left", { roomId, userId: user.id });
      } else if (wentOffline) {
        // Still a member, but offline
        const members = await roomService.buildMemberList(roomId);
        io.to(channel).emit("room:members", { roomId, members });
      }

      logger.info("room:leave ok", {
        roomId,
        userId: user.id,
        leaveMembership,
        wentOffline,
      });
    } catch (err) {
      emitRoomError(
        socket,
        err,
        typeof raw === "object" && raw && "roomId" in raw
          ? String((raw as { roomId?: string }).roomId)
          : undefined,
      );
    }
  });

  socket.on("disconnect", () => {
    const changes = roomPresence.removeSocket(socket.id, user.id);
    for (const { roomId, userWentOffline } of changes) {
      if (!userWentOffline) continue;
      void roomService
        .buildMemberList(roomId)
        .then((members) => {
          io.to(socketRoomName(roomId)).emit("room:members", {
            roomId,
            members,
          });
        })
        .catch((err) => {
          logger.warn({ err, roomId }, "failed to broadcast presence on disconnect");
        });
    }
  });
}