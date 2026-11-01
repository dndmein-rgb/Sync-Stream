"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessageView } from "@syncstream/contracts";
import type { AppSocket } from "@/lib/socket";

export function useChat(opts: {
  socket: AppSocket | null;
  roomId: string | null;
  enabled: boolean;
}) {
  const { socket, roomId, enabled } = opts;
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<
    Array<{ userId: string; name: string }>
  >([]);
  const [reactions, setReactions] = useState<
    Array<{
      id: string;
      userId: string;
      name: string;
      emoji: string;
      at: number;
    }>
  >([]);

  useEffect(() => {
    if (!socket || !roomId || !enabled) return;

    socket.emit("chat:history", { roomId, limit: 50 });

    const onMessage = (msg: ChatMessageView) => {
      if (msg.roomId !== roomId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    const onHistory = (payload: {
      roomId: string;
      messages: ChatMessageView[];
      nextCursor: string | null;
    }) => {
      if (payload.roomId !== roomId) return;
      setMessages([...payload.messages].reverse());
    };
    const onError = (payload: {
      code: string;
      message: string;
      roomId?: string;
    }) => {
      if (payload.roomId && payload.roomId !== roomId) return;
      setError(payload.message);
    };
    const onTyping = (payload: {
      roomId: string;
      userId: string;
      name: string;
      isTyping: boolean;
    }) => {
      if (payload.roomId !== roomId) return;
      setTyping((prev) => {
        const without = prev.filter((t) => t.userId !== payload.userId);
        return payload.isTyping
          ? [...without, { userId: payload.userId, name: payload.name }]
          : without;
      });
    };
    const onReaction = (payload: {
      roomId: string;
      userId: string;
      name: string;
      emoji: string;
      at: number;
    }) => {
      if (payload.roomId !== roomId) return;
      const id = `${payload.userId}-${payload.at}`;
      setReactions((prev) => [
        ...prev.slice(-20),
        {
          id,
          userId: payload.userId,
          name: payload.name,
          emoji: payload.emoji,
          at: payload.at,
        },
      ]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:history", onHistory);
    socket.on("chat:error", onError);
    socket.on("typing:update", onTyping);
    socket.on("reaction:new", onReaction);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:history", onHistory);
      socket.off("chat:error", onError);
      socket.off("typing:update", onTyping);
      socket.off("reaction:new", onReaction);
    };
  }, [socket, roomId, enabled]);

  const send = useCallback(
    (content: string) => {
      if (!socket || !roomId || !content.trim()) return;
      setError(null);
      socket.emit("chat:send", {
        roomId,
        content: content.trim(),
        clientMessageId: crypto.randomUUID(),
      });
    },
    [socket, roomId],
  );

  const setIsTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !roomId) return;
      socket.emit("typing:update", { roomId, isTyping });
    },
    [socket, roomId],
  );

  const react = useCallback(
    (emoji: string) => {
      if (!socket || !roomId) return;
      socket.emit("reaction:send", { roomId, emoji });
    },
    [socket, roomId],
  );

  return { messages, error, typing, reactions, send, setIsTyping, react };
}