import type { PlaybackState } from "@syncstream/contracts";

export function expectedPosition(state: PlaybackState, nowMs: number): number {
  if (state.status === "PAUSED") return Math.max(0, state.position);
  const elapsedSec = (nowMs - state.updatedAt) / 1000;
  return Math.max(0, state.position + state.playbackRate * elapsedSec);
}

export type DriftAction =
  | { kind: "none" }
  | { kind: "rate"; rate: number }
  | { kind: "seek"; position: number };

export function decideDriftCorrection(
  localPosition: number,
  expected: number,
  baseRate: number,
): DriftAction {
  const driftSec = localPosition - expected;
  const abs = Math.abs(driftSec);

  if (abs < 0.15) return { kind: "none" };

  if (abs <= 0.5) {
    const adj = driftSec < 0 ? 1.04 : 0.96;
    return { kind: "rate", rate: baseRate * adj };
  }

  return { kind: "seek", position: expected };
}