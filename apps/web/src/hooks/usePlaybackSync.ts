"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState, RoomRole } from "@syncstream/contracts";
import type { AppSocket } from "@/lib/socket";
import { decideDriftCorrection, expectedPosition } from "@/lib/playback/math";
import {
  HtmlVideoPlayer,
  type VideoPlayer,
} from "@/lib/playback/video-player";
import { serverClock } from "@/lib/playback/clock";

const SAMPLE_MS = 400;
const RATE_RESET_MS = 2_000;
const APPLY_LOCK_MS = 800;

function emptyState(): PlaybackState {
  return {
    videoId: "",
    status: "PAUSED",
    position: 0,
    updatedAt: Date.now(),
    playbackRate: 1,
    sequence: 0,
  };
}

export function usePlaybackSync(opts: {
  socket: AppSocket | null;
  roomId: string | null;
  role: RoomRole | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
}) {
  const { socket, roomId, role, videoRef, ready } = opts;
  const [state, setState] = useState<PlaybackState>(emptyState());
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appliedSeq = useRef(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const bufferingRef = useRef(false);
  const rateResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingUntil = useRef(0);

  const canControl = role === "HOST" || role === "CO_HOST";

  const lockApply = useCallback((ms = APPLY_LOCK_MS) => {
    applyingUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = videoRef.current;
    if (!el) return;
    playerRef.current = new HtmlVideoPlayer(el);

    const onWaiting = () => {
      bufferingRef.current = true;
    };
    const onPlaying = () => {
      bufferingRef.current = false;
      setNeedsGesture(false);
    };
    const onError = () => setLoadError("Failed to load video");

    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("error", onError);
      playerRef.current = null;
    };
  }, [videoRef, ready]);

  const applyState = useCallback(
    async (next: PlaybackState) => {
      if (next.sequence < appliedSeq.current) return;
      appliedSeq.current = next.sequence;
      setState(next);

      const player = playerRef.current;
      if (!player) return;

      lockApply();
      try {
        if (next.videoId && player.getSrc() !== next.videoId) {
          setLoadError(null);
          player.setSrc(next.videoId);
        }

        const now = serverClock.now();
        const target = expectedPosition(next, now);
        player.setPlaybackRate(next.playbackRate || 1);

        const local = player.getCurrentTime();
        if (Math.abs(local - target) > 0.5) {
          player.seek(target);
        }

        if (next.status === "PLAYING") {
          try {
            await player.play();
            setNeedsGesture(false);
          } catch {
            setNeedsGesture(true);
          }
        } else {
          player.pause();
        }
      } finally {
        lockApply(APPLY_LOCK_MS);
      }
    },
    [lockApply],
  );

  useEffect(() => {
    if (!socket || !roomId || !ready) return;

    const onState = (payload: { roomId: string; state: PlaybackState }) => {
      if (payload.roomId !== roomId) return;
      void applyState(payload.state);
    };
    const onSnapshot = (payload: { roomId: string; state: PlaybackState }) => {
      if (payload.roomId !== roomId) return;
      void applyState(payload.state);
    };
    const onError = (payload: {
      code: string;
      message: string;
      roomId?: string;
    }) => {
      if (payload.roomId && payload.roomId !== roomId) return;
      setError(payload.message);
    };

    socket.on("playback:state", onState);
    socket.on("playback:snapshot", onSnapshot);
    socket.on("playback:error", onError);
    socket.emit("playback:sync", { roomId });

    return () => {
      socket.off("playback:state", onState);
      socket.off("playback:snapshot", onSnapshot);
      socket.off("playback:error", onError);
    };
  }, [socket, roomId, applyState, ready]);

  useEffect(() => {
    if (!socket) return;
    const onPong = (p: { serverTime: number; clientTime: number }) =>
      serverClock.addSample(p.clientTime, p.serverTime);
    const ping = () => socket.emit("client:ping", { clientTime: Date.now() });
    socket.on("server:pong", onPong);
    ping();
    const burst = [250, 500, 1000].map((ms) => setTimeout(ping, ms));
    const id = setInterval(ping, 30_000);
    return () => {
      socket.off("server:pong", onPong);
      burst.forEach(clearTimeout);
      clearInterval(id);
    };
  }, [socket]);

  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player || !state.videoId) return;
      if (Date.now() < applyingUntil.current) return;
      if (bufferingRef.current || needsGesture) return;
      if (state.status !== "PLAYING") {
        player.setPlaybackRate(state.playbackRate || 1);
        return;
      }

      const expected = expectedPosition(state, serverClock.now());
      const local = player.getCurrentTime();
      const action = decideDriftCorrection(
        local,
        expected,
        state.playbackRate || 1,
      );

      if (action.kind === "rate") {
        player.setPlaybackRate(action.rate);
        if (rateResetTimer.current) clearTimeout(rateResetTimer.current);
        rateResetTimer.current = setTimeout(() => {
          player.setPlaybackRate(state.playbackRate || 1);
        }, RATE_RESET_MS);
      } else if (action.kind === "seek") {
        lockApply(500);
        player.seek(action.position);
        player.setPlaybackRate(state.playbackRate || 1);
      }
    }, SAMPLE_MS);

    return () => {
      clearInterval(id);
      if (rateResetTimer.current) clearTimeout(rateResetTimer.current);
    };
  }, [roomId, state, needsGesture, lockApply]);

  const sendCommand = useCallback(
    (cmd: {
      action: "PLAY" | "PAUSE" | "SEEK" | "CHANGE_VIDEO";
      position?: number;
      videoId?: string;
    }) => {
      if (!socket || !roomId || !canControl) return;
      setError(null);
      lockApply(cmd.action === "SEEK" ? 1200 : APPLY_LOCK_MS);
      socket.emit("playback:command", {
        roomId,
        action: cmd.action,
        position: cmd.position,
        videoId: cmd.videoId,
        commandId: crypto.randomUUID(),
      });
    },
    [socket, roomId, canControl, lockApply],
  );

  const resumeFromGesture = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.play();
      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }
  }, []);

  const requestSync = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit("playback:sync", { roomId });
  }, [socket, roomId]);

  return {
    state,
    canControl,
    needsGesture,
    loadError,
    error,
    sendCommand,
    resumeFromGesture,
    requestSync,
  };
}