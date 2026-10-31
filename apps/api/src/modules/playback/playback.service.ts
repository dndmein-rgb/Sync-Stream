import {
  PlaybackCommand,
  PlaybackState,
  RoomRole,
} from "@syncstream/contracts";
import { RoomPlayback } from "./playback.types.js";
import { ForbiddenError, ValidationError } from "@syncstream/shared-utils";
import { assertCan } from "../room/room.permissions.js";

const MAX_RECENT_COMMANDS = 64; // per room – enough to stop network retries

/**
 * Single-process authoritative playback state.
 * Key = roomId.
 *
 * Later (Phase 6) this Map moves behind Redis + Lua, but the public API
 * of the service stays the same.
 */

export class PlaybackService {
  private readonly states = new Map<string, RoomPlayback>();
  /** roomId → recent commandIds (for deduplication) */
  private readonly recentCommands = new Map<string, Set<string>>();

  /** Returns current state or null if the room has never selected a video. */
  getState(roomId: string): PlaybackState | null {
    const s = this.states.get(roomId);
    return s ? { ...s } : null;
  }

  /**
   * Apply a host/co-host command.
   * Throws AppError subclasses on validation / permission failure.
   */
  applyCommand(
    roomId: string,
    userId: string,
    role: RoomRole,
    cmd: PlaybackCommand,
  ) {
    // 1. Permission
    assertCan(role, "PLAYBACK_CONTROL");
    // 2. Deduplication
    if (this.isDuplicate(roomId, cmd.commandId)) {
      const current = this.states.get(roomId);
      if (!current) {
        // very unlikely – command was accepted earlier but state gone
        throw new ValidationError("Duplicate command but no state exists");
      }
      return { state: { ...current }, duplicate: true };
    }
    const now = Date.now();
    let current = this.states.get(roomId);

    // 3. State transition
    let next: RoomPlayback;
    switch (cmd.action) {
      case "CHANGE_VIDEO": {
        if (!cmd.videoId) {
          throw new ValidationError("videoId is required for CHANGE_VIDEO");
        }

        next = {
          videoId: cmd.videoId,
          status: "PAUSED",
          position: 0,
          updatedAt: now,
          playbackRate: 1,
          sequence: current ? current.sequence + 1 : 1,
        };
        break;
      }
      case "PLAY": {
        if (!current) {
          throw new ValidationError("No video selected – CHANGE_VIDEO first");
        }
        // If already playing we still accept the command (idempotent) but
        // re-anchor the position so late clients stay in sync.
        const position =
          cmd.position !== undefined
            ? cmd.position
            : this.expectedPosition(current, now);
        next = {
          ...current,
          status: "PLAYING",
          position,
          updatedAt: now,
          sequence: current.sequence + 1,
        };
        break;
      }
      case "PAUSE": {
        if (!current) {
          throw new ValidationError("No video selected – CHANGE_VIDEO first");
        }
        const position = this.expectedPosition(current, now);
        next = {
          ...current,
          status: "PAUSED",
          position,
          updatedAt: now,
          sequence: current.sequence + 1,
        };
        break;
      }
      case "SEEK": {
        if (!current) {
          throw new ValidationError("No video selected – CHANGE_VIDEO first");
        }
        if (cmd.position === undefined) {
          throw new ValidationError("position is required for SEEK");
        }
        if (cmd.position < 0) {
          throw new ValidationError("position cannot be negative");
        }
        next = {
          ...current,
          position: cmd.position,
          updatedAt: now,
          sequence: current.sequence + 1,
          // keep current status (playing or paused)
        };
        break;
      }
      default: {
        // exhaustive check
        const _exhaustive: never = cmd.action;
        throw new ValidationError(`Unknown action: ${_exhaustive}`);
      }
    }
    // 4. Persist + remember commandId
    this.states.set(roomId, next);
    this.rememberCommand(roomId, cmd.commandId);

    return { state: { ...next }, duplicate: false };
  }
  /** Remove state when a room is deleted (called from room service later). */
  clearRoom(roomId: string): void {
    this.states.delete(roomId);
    this.recentCommands.delete(roomId);
  }

  // ── helpers ──────────────────────────────────────────────

  /**
   * Expected playback position at time `now` according to the formula:
   *   PLAYING → position + rate * (now - updatedAt) / 1000
   *   PAUSED  → position
   */
  expectedPosition(state: PlaybackState, now: number): number {
    if (state.status === "PAUSED") return state.position;
    const elapsedSec = (now - state.updatedAt) / 1000;
    return Math.max(0, state.position + state.playbackRate * elapsedSec);
  }
  private isDuplicate(roomId: string, commandId: string): boolean {
    const set = this.recentCommands.get(roomId);
    return set ? set.has(commandId) : false;
  }
  private rememberCommand(roomId: string, commandId: string): void {
    let set = this.recentCommands.get(roomId);
    if (!set) {
      set = new Set();
      this.recentCommands.set(roomId, set);
    }
    set.add(commandId);
    // simple bound – drop oldest when over limit (Set iteration order is insertion order)
    if (set.size > MAX_RECENT_COMMANDS) {
      const first = set.values().next().value;
      if (first !== undefined) set.delete(first);
    }
  }
}
