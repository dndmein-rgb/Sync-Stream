import { logger } from "../../config/logger.js";
import { roomService } from "../room/room.container.js";
import { roomPresence } from "./room-presence.js";
import { socketRoomName } from "../room/room.helper.js";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@syncstream/contracts";
import { config } from "../../config/index.js";

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;


type Pending = {
  timer: NodeJS.Timeout;
  hostId: string;
};

class HostLifecycle {
  private readonly pending = new Map<string, Pending>(); // roomId → pending

  /**
   * Call when host presence goes offline in a room.
   */
  onHostWentOffline(io: IoServer, roomId: string, hostId: string) {
    this.cancel(roomId); // reset if already pending

    const timer = setTimeout(() => {
      void this.expire(io, roomId, hostId);
    }, config.HOST_GRACE_MS);
    // Don't keep process alive solely for grace timers
    timer.unref?.();

    this.pending.set(roomId, { timer, hostId });
    logger.info("host grace started", { roomId, hostId, graceMs: config.HOST_GRACE_MS });
  }

  /**
   * Call when host presence becomes online again.
   */
  onHostCameOnline(roomId: string, hostId: string) {
    const p = this.pending.get(roomId);
    if (!p || p.hostId !== hostId) return;
    this.cancel(roomId);
    logger.info("host grace cancelled (reconnected)", { roomId, hostId });
  }

  cancel(roomId: string) {
    const p = this.pending.get(roomId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(roomId);
  }

  private async expire(io: IoServer, roomId: string, hostId: string) {
    this.pending.delete(roomId);

    // Host came back on another code path?
    if (await roomPresence.isOnline(roomId, hostId)) {
      logger.info("host grace expired but host online; skip", { roomId, hostId });
      return;
    }

    try {
      const members = await roomService.buildMemberList(roomId);
      // Prefer online CO_HOST, then any online non-host member
      const candidate =
        members.find((m) => m.online && m.role === "CO_HOST" && m.userId !== hostId) ??
        members.find((m) => m.online && m.userId !== hostId);

      if (!candidate) {
        logger.warn("host grace expired; no eligible member", { roomId, hostId });
        // Optional: mark room inactive / delete — product choice
        return;
      }

      await roomService.forceTransferHost(roomId, hostId, candidate.userId);
      const updated = await roomService.buildMemberList(roomId);
      const channel = socketRoomName(roomId);

      io.to(channel).emit("room:host-changed", {
        roomId,
        previousHostId: hostId,
        newHostId: candidate.userId,
        reason: "DISCONNECT_GRACE",
      });
      io.to(channel).emit("room:members", { roomId, members: updated });

      logger.info("host transferred after grace", {
        roomId,
        previousHostId: hostId,
        newHostId: candidate.userId,
      });
    } catch (err) {
      logger.error("host grace transfer failed", { err, roomId, hostId });
    }
  }
}

export const hostLifecycle = new HostLifecycle();