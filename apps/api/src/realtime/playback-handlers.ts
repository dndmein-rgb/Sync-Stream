import {
  ClientToServerEvents,
  InterServerEvents,
  PlaybackCommandSchema,
  PlaybackSyncPayloadSchema,
  ServerToClientEvents,
  SocketData,
} from "@syncstream/contracts";
import { AppError } from "@syncstream/shared-utils";
import { Server, Socket } from "socket.io";
import { logger } from "../config/logger.js";
import { roomService } from "../modules/room/room.container.js";
import { playbackService } from "../modules/playback/playback.container.js";
import { socketRoomName } from "../modules/room/room.helper.js";

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

function emitPlaybackError(
  socket: AppSocket,
  err: unknown,
  roomId?: string,
  commandId?: string,
) {
  if (err instanceof AppError) {
    socket.emit("playback:error", {
      code: err.code,
      message: err.message,
      roomId,
      commandId,
    });
    return;
  }
  logger.error("playback handler error", { err });
  socket.emit("playback:error", {
    code: "INTERNAL_ERROR",
    message: "Unexpected playback error",
    roomId,
    commandId,
  });
}
export function registerPlaybackHandlers(io: IoServer, socket: AppSocket) {
  const user = socket.data.user
  if (!user) return
  // ── Client asks for current state (reconnect / late join) ──────────
  socket.on("playback:sync", async (raw) => {
    try {
      const parsed = PlaybackSyncPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit("playback:error", {
                  code: "BAD_REQUEST",
                  message: parsed.error.issues.map((i) => i.message).join(", "),
                });
                return;
      }
      const { roomId } = parsed.data
      // Must be a member
      await roomService.assertMember(roomId, user.id);
      const state = playbackService.getState(roomId)
      if (!state) {
              // No video has been selected yet – still a valid reply
              socket.emit("playback:snapshot", {
                roomId,
                state: {
                  videoId: "",
                  status: "PAUSED",
                  position: 0,
                  updatedAt: Date.now(),
                  playbackRate: 1,
                  sequence: 0,
                },
              });
              return;
      }

      socket.emit("playback:snapshot", { roomId, state });
    } catch (err) {
      emitPlaybackError(socket,err,typeof raw === "object" && raw && "roomId" in raw
                ? String((raw as { roomId?: string }).roomId)
                : undefined)
    }
  })

  // ── Host / co-host issues a command ────────────────────────────────
  socket.on("playback:command", async (raw) => {
    let commandId: string | undefined;
    let roomId: string | undefined;
    try {
      const parsed = PlaybackCommandSchema.safeParse(raw)
      if (!parsed.success) {
              socket.emit("playback:error", {
                code: "BAD_REQUEST",
                message: parsed.error.issues.map((i) => i.message).join(", "),
              });
              return;
      }
      const cmd = parsed.data
      commandId = cmd.commandId;
      roomId = cmd.roomId;

      // Membership + role
            const membership = await roomService.assertMember(roomId, user.id);
      
            const result = playbackService.applyCommand(
              roomId,
              user.id,
              membership.role,
              cmd,
            );
            // Even on duplicate we still broadcast the current state so the
                  // client that retried gets the latest sequence.
      const channel = socketRoomName(roomId)
      io.to(channel).emit("playback:state", {
              roomId,
              state: result.state,
            });
      
            logger.info("playback:command accepted", {
              roomId,
              userId: user.id,
              action: cmd.action,
              sequence: result.state.sequence,
              duplicate: result.duplicate,
            });
    }
    catch (err) {
      emitPlaybackError(socket, err, roomId, commandId);
    }
  })
  }
