"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RoomMemberView,
  RoomView,
  RoomRole,
} from "@syncstream/contracts";
import type { AppSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";

export function useRoomSession(opts: {
  socket: AppSocket | null;
  roomId: string;
  code?: string;
}) {
  const { socket, roomId, code } = opts;
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [members, setMembers] = useState<RoomMemberView[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);

  const myRole: RoomRole | null =
    room?.myRole ??
    members.find((m) => m.userId === user?.id)?.role ??
    null;

  useEffect(() => {
    if (!socket || !roomId) return;

    setError(null);
    setKicked(false);
    socket.emit("room:join", {
      roomId,
      ...(code ? { code } : {}),
    });

    const onState = (payload: {
      room: RoomView;
      members: RoomMemberView[];
    }) => {
      setRoom(payload.room);
      setMembers(payload.members);
      setJoined(true);
    };
    const onMembers = (payload: {
      roomId: string;
      members: RoomMemberView[];
    }) => {
      if (payload.roomId !== roomId) return;
      setMembers(payload.members);
    };
    const onError = (payload: {
      code: string;
      message: string;
      roomId?: string;
    }) => {
      if (payload.roomId && payload.roomId !== roomId) return;
      setError(payload.message);
    };
    const onHostChanged = (payload: {
      roomId: string;
      previousHostId: string;
      newHostId: string;
      reason: string;
    }) => {
      if (payload.roomId !== roomId) return;
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              hostId: payload.newHostId,
              myRole:
                user?.id === payload.newHostId
                  ? "HOST"
                  : prev.myRole === "HOST"
                    ? "VIEWER"
                    : prev.myRole,
            }
          : prev,
      );
    };
    const onRemoved = (payload: {
      roomId: string;
      userId: string;
      removedBy: string;
    }) => {
      if (payload.roomId !== roomId) return;
      if (payload.userId === user?.id) {
        setKicked(true);
        setJoined(false);
      }
    };
    const onRoleChanged = (payload: {
      roomId: string;
      userId: string;
      role: RoomRole;
    }) => {
      if (payload.roomId !== roomId) return;
      if (payload.userId === user?.id) {
        setRoom((prev) =>
          prev ? { ...prev, myRole: payload.role } : prev,
        );
      }
    };

    socket.on("room:state", onState);
    socket.on("room:members", onMembers);
    socket.on("room:error", onError);
    socket.on("room:host-changed", onHostChanged);
    socket.on("room:member-removed", onRemoved);
    socket.on("room:member-role-changed", onRoleChanged);

    const onConnect = () => {
      socket.emit("room:join", {
        roomId,
        ...(code ? { code } : {}),
      });
    };
    socket.on("connect", onConnect);

    return () => {
      socket.off("room:state", onState);
      socket.off("room:members", onMembers);
      socket.off("room:error", onError);
      socket.off("room:host-changed", onHostChanged);
      socket.off("room:member-removed", onRemoved);
      socket.off("room:member-role-changed", onRoleChanged);
      socket.off("connect", onConnect);
      socket.emit("room:leave", { roomId, leaveMembership: false });
    };
  }, [socket, roomId, code, user?.id]);

  const leavePermanently = useCallback(() => {
    if (!socket) return;
    socket.emit("room:leave", { roomId, leaveMembership: true });
    setJoined(false);
  }, [socket, roomId]);

  const transferHost = useCallback(
    (toUserId: string) => {
      if (!socket) return;
      socket.emit("room:transfer-host", { roomId, toUserId });
    },
    [socket, roomId],
  );

  const removeMember = useCallback(
    (userId: string) => {
      if (!socket) return;
      socket.emit("room:remove-member", { roomId, userId });
    },
    [socket, roomId],
  );

  const changeRole = useCallback(
    (userId: string, role: "CO_HOST" | "VIEWER") => {
      if (!socket) return;
      socket.emit("room:change-role", { roomId, userId, role });
    },
    [socket, roomId],
  );

  return {
    room,
    members,
    joined,
    myRole,
    error,
    kicked,
    leavePermanently,
    transferHost,
    removeMember,
    changeRole,
  };
}