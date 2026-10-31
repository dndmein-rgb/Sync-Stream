import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@syncstream/contracts";
import { ClientPingSchema } from "@syncstream/contracts";
import { config } from "../../config/index.js";
import { logger } from "../../config/logger.js";
import { registerSocketAuth } from "./socket-auth.js";
import { registerRoomHandlers } from "./room-handlers.js";
import { registerPlaybackHandlers } from "./playback-handlers.js";
import { registerChatHandlers } from "./chat-handlers.js";
import { redis } from "../../infrastructure/redis.js";
import { createAdapter } from "@socket.io/redis-adapter";

export function createSocketServer(httpServer: HttpServer) {
  const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
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
    adapter: createAdapter(pubClient, subClient),
  });

  registerSocketAuth(io);

  io.on("connection", (socket) => {
    const user = socket.data.user;
    logger.info("Socket connected", {
      socketId: socket.id,
      userId: user?.id,
    });

    socket.emit("server:hello", {
      message: `Connected as ${user?.email ?? "unknown"}`,
      serverTime: Date.now(),
      socketId: socket.id,
    });

    socket.on("client:ping", (raw) => {
      const parsed = ClientPingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn("Invalid client:ping", { socketId: socket.id });
        return;
      }
      socket.emit("server:pong", {
        serverTime: Date.now(),
        clientTime: parsed.data.clientTime,
      });
    });

    registerRoomHandlers(io, socket);
    registerPlaybackHandlers(io, socket);  
   registerChatHandlers(io, socket); 

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", {
        socketId: socket.id,
        userId: user?.id,
        reason,
      });
    });
  });

  return io;
}