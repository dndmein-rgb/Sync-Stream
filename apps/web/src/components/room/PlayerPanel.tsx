"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlaybackState, RoomRole } from "@syncstream/contracts";
import { Button, Input } from "@/components/ui";

const SAMPLE_VIDEOS = [
  {
    label: "Flower (short)",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    label: "Big Buck Bunny 10s",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  },
  {
    label: "Big Buck Bunny (full)",
    url: "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
  },
];

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: PlaybackState;
  canControl: boolean;
  role: RoomRole | null;
  needsGesture: boolean;
  loadError: string | null;
  error: string | null;
  onCommand: (cmd: {
    action: "PLAY" | "PAUSE" | "SEEK" | "CHANGE_VIDEO";
    position?: number;
    videoId?: string;
  }) => void;
  onResumeGesture: () => void;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  }
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function PlayerPanel({
  videoRef,
  state,
  canControl,
  needsGesture,
  loadError,
  error,
  onCommand,
  onResumeGesture,
}: Props) {
  const [customUrl, setCustomUrl] = useState("");
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubbingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  // Local volume (not synced to the room)
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const lastVolumeRef = useRef(1);

  // Keep <video> volume/mute in sync
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, volume));
    el.muted = muted;
  }, [videoRef, volume, muted, state.videoId]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const sync = () => {
      if (!scrubbingRef.current) {
        setLocalTime(el.currentTime || 0);
      }
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    };

    sync();
    el.addEventListener("timeupdate", sync);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    el.addEventListener("seeked", sync);
    el.addEventListener("play", sync);
    el.addEventListener("pause", sync);
    const id = window.setInterval(sync, 200);

    return () => {
      el.removeEventListener("timeupdate", sync);
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
      el.removeEventListener("seeked", sync);
      el.removeEventListener("play", sync);
      el.removeEventListener("pause", sync);
      window.clearInterval(id);
    };
  }, [videoRef, state.videoId]);

  function beginScrub() {
    if (!canControl || !state.videoId) return;
    scrubbingRef.current = true;
    setScrubbing(true);
    setScrubValue(videoRef.current?.currentTime ?? localTime);
  }

  function onScrubChange(v: number) {
    if (!scrubbingRef.current) beginScrub();
    setScrubValue(v);
  }

  function endScrub(v: number) {
    if (!canControl) {
      scrubbingRef.current = false;
      setScrubbing(false);
      return;
    }
    const el = videoRef.current;
    const dur =
      el && Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : duration;
    const pos = Math.max(0, Math.min(v, dur > 0 ? dur : v));

    if (el) {
      try {
        el.currentTime = pos;
      } catch {
        /* ignore */
      }
    }
    setLocalTime(pos);
    scrubbingRef.current = false;
    setScrubbing(false);
    onCommand({ action: "SEEK", position: pos });
  }

  function submitUrl(e: FormEvent) {
    e.preventDefault();
    const url = customUrl.trim();
    if (!url || !canControl) return;
    onCommand({ action: "CHANGE_VIDEO", videoId: url });
  }

  function jump(delta: number) {
    if (!canControl) return;
    const el = videoRef.current;
    const base = el?.currentTime ?? localTime;
    const dur = el && Number.isFinite(el.duration) ? el.duration : duration;
    const pos = Math.max(
      0,
      Math.min(base + delta, dur > 0 ? dur : base + delta),
    );
    if (el) {
      try {
        el.currentTime = pos;
      } catch {
        /* ignore */
      }
    }
    setLocalTime(pos);
    onCommand({ action: "SEEK", position: pos });
  }

  function toggleMute() {
    if (muted) {
      setMuted(false);
      setVolume(lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.5);
    } else {
      lastVolumeRef.current = volume > 0 ? volume : lastVolumeRef.current;
      setMuted(true);
    }
  }

  function onVolumeChange(v: number) {
    const next = Math.min(1, Math.max(0, v));
    setVolume(next);
    if (next > 0) {
      lastVolumeRef.current = next;
      setMuted(false);
    } else {
      setMuted(true);
    }
  }

  const displayTime = scrubbing ? scrubValue : localTime;
  const maxDur = duration > 0 ? duration : Math.max(localTime, 1);
  const volumeIcon = muted || volume === 0 ? "🔇" : volume < 0.4 ? "🔈" : "🔊";

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full object-contain bg-black"
          playsInline
          preload="auto"
          controls={false}
        />

        {needsGesture && (
          <button
            type="button"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-sm font-medium text-white"
            onClick={onResumeGesture}
          >
            Tap to start playback
          </button>
        )}

        {!state.videoId && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-400">
            {canControl
              ? "Select a video to begin"
              : "Waiting for host to pick a video"}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="badge bg-white/10 text-slate-200">{state.status}</span>
          <span>seq {state.sequence}</span>
          <span className="font-mono text-slate-200">
            {formatTime(displayTime)}
            <span className="text-slate-500"> / </span>
            {duration > 0 ? formatTime(duration) : "--:--"}
          </span>
        </div>

        {(error || loadError) && (
          <p className="text-sm text-rose-300">{error || loadError}</p>
        )}

        {/* Seek */}
        <input
          type="range"
          min={0}
          max={maxDur}
          step={0.05}
          value={Math.min(Math.max(displayTime, 0), maxDur)}
          disabled={!canControl || !state.videoId}
          className="w-full cursor-pointer accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          onMouseDown={beginScrub}
          onTouchStart={beginScrub}
          onChange={(e) => onScrubChange(Number(e.target.value))}
          onMouseUp={(e) =>
            endScrub(Number((e.target as HTMLInputElement).value))
          }
          onTouchEnd={(e) =>
            endScrub(Number((e.target as HTMLInputElement).value))
          }
        />

        {/* Volume — available to everyone */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-base"
            title={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {volumeIcon}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            className="h-1 w-28 cursor-pointer accent-indigo-500 sm:w-40"
            aria-label="Volume"
            onChange={(e) => onVolumeChange(Number(e.target.value))}
          />
          <span className="w-8 text-xs tabular-nums text-slate-500">
            {Math.round((muted ? 0 : volume) * 100)}%
          </span>
        </div>

        {canControl && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  onCommand({
                    action: "PLAY",
                    position: videoRef.current?.currentTime,
                  })
                }
              >
                Play
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onCommand({ action: "PAUSE" })}
              >
                Pause
              </Button>
              <Button type="button" variant="ghost" onClick={() => jump(-10)}>
                −10s
              </Button>
              <Button type="button" variant="ghost" onClick={() => jump(10)}>
                +10s
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Sample videos</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_VIDEOS.map((v) => (
                  <Button
                    key={v.url}
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() =>
                      onCommand({ action: "CHANGE_VIDEO", videoId: v.url })
                    }
                  >
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>

            <form className="flex gap-2" onSubmit={submitUrl}>
              <Input
                placeholder="Or paste a direct MP4 URL"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
              <Button type="submit" variant="ghost">
                Load
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}