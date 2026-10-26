import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@syncstream/contracts";
import { ClientPingSchema } from "@syncstream/contracts";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: config.SOCKET_PATH,
    cors: {
      origin: config.CLIENT_ORIGINS,
      credentials: true,
    },
    // Phase 0: single instance — no Redis adapter yet
  });

  io.on("connection", (socket) => {
    logger.info("Socket connected", { socketId: socket.id });

    // Immediate hello so the client can prove transport works
    socket.emit("server:hello", {
      message: "Connected to SyncStream API",
      serverTime: Date.now(),
      socketId: socket.id,
    });

    socket.on("client:ping", (raw) => {
      const parsed = ClientPingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn("Invalid client:ping payload", {
          socketId: socket.id,
          issues: parsed.error.issues,
        });
        return;
      }

      socket.emit("server:pong", {
        serverTime: Date.now(),
        clientTime: parsed.data.clientTime,
      });
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", { socketId: socket.id, reason });
    });
  });

  return io;
}