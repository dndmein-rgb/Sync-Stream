"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSocketConnection } from "@/hooks/useSocketConnection";
import { useRoomSession } from "@/hooks/useRoomSession";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { useChat } from "@/hooks/useChat";
import { PlayerPanel } from "@/components/room/PlayerPanel";
import { ChatPanel } from "@/components/room/ChatPanel";
import { MembersPanel } from "@/components/room/MembersPanel";
import {
  Alert,
  Button,
  Header,
  Shell,
  StatusDot,
} from "@/components/ui";

export function RoomClient({ roomId }: { roomId: string }) {
  const search = useSearchParams();
  const code = search.get("code") ?? undefined;
  const router = useRouter();
  const { user, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const enabled = Boolean(user && roomId);
  const { socket, status } = useSocketConnection(enabled);

  const session = useRoomSession({ socket, roomId, code });

  const playback = usePlaybackSync({
    socket,
    roomId,
    role: session.myRole,
    videoRef,
    ready: !loading && Boolean(user),
  });

  const chat = useChat({
    socket,
    roomId,
    enabled: session.joined,
  });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (session.kicked) router.replace("/rooms");
  }, [session.kicked, router]);

  const inviteHint = useMemo(() => session.room?.code ?? null, [session.room]);

  if (loading || !user) {
    return (
      <Shell>
        <p className="text-slate-400">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        title={session.room?.name ?? "Room"}
        right={
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot
              status={
                status === "connected"
                  ? "connected"
                  : status === "connecting"
                    ? "connecting"
                    : status === "error"
                      ? "error"
                      : "disconnected"
              }
            />
            <Button
              variant="ghost"
              onClick={() => {
                session.leavePermanently();
                router.push("/rooms");
              }}
            >
              Leave
            </Button>
          </div>
        }
      />

      {inviteHint && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>
            Invite code:{" "}
            <code className="rounded-lg bg-white/10 px-2 py-1 font-mono text-accent-soft">
              {inviteHint}
            </code>
          </span>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => void navigator.clipboard.writeText(inviteHint)}
          >
            Copy code
          </Button>
          {session.myRole && (
            <span className="badge bg-white/10">You: {session.myRole}</span>
          )}
        </div>
      )}

      {session.error && (
        <div className="mb-4">
          <Alert>{session.error}</Alert>
        </div>
      )}

      {!session.joined && !session.error && (
        <p className="mb-4 text-sm text-slate-400">Joining room…</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <PlayerPanel
            videoRef={videoRef}
            state={playback.state}
            canControl={playback.canControl}
            role={session.myRole}
            needsGesture={playback.needsGesture}
            loadError={playback.loadError}
            error={playback.error}
            onCommand={playback.sendCommand}
            onResumeGesture={() => void playback.resumeFromGesture()}
          />
          <MembersPanel
            members={session.members}
            myRole={session.myRole}
            myUserId={user.id}
            hostId={session.room?.hostId}
            onTransfer={session.transferHost}
            onRemove={session.removeMember}
            onChangeRole={session.changeRole}
          />
        </div>
        <ChatPanel
          messages={chat.messages}
          typing={chat.typing}
          reactions={chat.reactions}
          error={chat.error}
          onSend={chat.send}
          onTyping={chat.setIsTyping}
          onReact={chat.react}
        />
      </div>
    </Shell>
  );
}