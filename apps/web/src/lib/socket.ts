"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@syncstream/contracts";
import { config } from "./config";
import { getAccessToken } from "./auth-storage";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket | null {
  return socket;
}

export function connectSocket(): AppSocket {
  if (socket?.connected) return socket;

  const token = getAccessToken();
  if (!token) {
    throw new Error("Cannot connect socket without access token");
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(config.socketUrl, {
    path: config.socketPath,
    autoConnect: true,
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  }) as AppSocket;

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function updateSocketAuth(token: string) {
  if (!socket) return;
  socket.auth = { token };
}