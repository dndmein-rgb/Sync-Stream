"use client";

import { useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket, type AppSocket } from "@/lib/socket";
import { getAccessToken } from "@/lib/auth-storage";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function useSocketConnection(enabled: boolean) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setSocket(null);
      return;
    }
    if (!getAccessToken()) {
      setStatus("error");
      setError("Not authenticated");
      return;
    }

    let s: AppSocket;
    try {
      setStatus("connecting");
      s = connectSocket();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Socket connect failed");
      return;
    }

    const onConnect = () => {
      setStatus("connected");
      setError(null);
      setSocket(s);
    };
    const onDisconnect = () => setStatus("disconnected");
    const onConnectError = (err: Error) => {
      setStatus("error");
      setError(err.message);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    if (s.connected) onConnect();
    setSocket(s);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      if (!enabledRef.current) disconnectSocket();
    };
  }, [enabled]);

  return { socket, status, error };
}