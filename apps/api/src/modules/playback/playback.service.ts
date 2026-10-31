import {
  PlaybackCommand,
  PlaybackState,
  RoomRole,
} from "@syncstream/contracts";
import { ValidationError } from "@syncstream/shared-utils";
import { assertCan } from "../room/room.permissions.js";
import { redis } from "../../infrastructure/redis.js";
import { logger } from "../../config/logger.js";

const MAX_RECENT_COMMANDS = 64;

const STATE_KEY = (roomId: string) => `playback:room:${roomId}`;
const CMDS_KEY = (roomId: string) => `playback:cmds:${roomId}`;

/**
 * Atomic apply-command Lua script.
 *
 * KEYS[1] = state key
 * KEYS[2] = recent-commands set
 * ARGV[1] = commandId
 * ARGV[2] = new state JSON
 * ARGV[3] = max recent commands
 *
 * Returns JSON:
 *   { "duplicate": true,  "state": <current|null> }
 *   { "duplicate": false, "state": <new> }
 */
const APPLY_SCRIPT = `
local stateKey = KEYS[1]
local cmdsKey  = KEYS[2]
local cmdId    = ARGV[1]
local newJson  = ARGV[2]
local maxCmds  = tonumber(ARGV[3])

if redis.call("SISMEMBER", cmdsKey, cmdId) == 1 then
  local current = redis.call("GET", stateKey)
  return cjson.encode({
    duplicate = true,
    state     = current and cjson.decode(current) or cjson.null
  })
end

redis.call("SET", stateKey, newJson)
redis.call("SADD", cmdsKey, cmdId)

local size = redis.call("SCARD", cmdsKey)
if size > maxCmds then
  local members = redis.call("SRANDMEMBER", cmdsKey, size - maxCmds)
  if type(members) == "table" then
    for _, m in ipairs(members) do
      redis.call("SREM", cmdsKey, m)
    end
  end
end

return cjson.encode({
  duplicate = false,
  state     = cjson.decode(newJson)
})
`;

export class PlaybackService {
  /** Current state or null if no video has been selected yet. */
  async getState(roomId: string): Promise<PlaybackState | null> {
    const raw = await redis.get(STATE_KEY(roomId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlaybackState;
    } catch {
      logger.error({ roomId }, "Corrupt playback state in Redis");
      return null;
    }
  }

  /**
   * Apply a host/co-host command.
   * Throws AppError subclasses on validation / permission failure.
   */
  async applyCommand(
    roomId: string,
    _userId: string,
    role: RoomRole,
    cmd: PlaybackCommand,
  ): Promise<{ state: PlaybackState; duplicate: boolean }> {
    // 1. Permission
    assertCan(role, "PLAYBACK_CONTROL");

    // 2. Load current state for transition logic
    const current = await this.getState(roomId);
    const now = Date.now();

    // 3. Compute next state (pure)
    let next: PlaybackState;

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
        };
        break;
      }
      default: {
        const _exhaustive: never = cmd.action;
        throw new ValidationError(`Unknown action: ${_exhaustive}`);
      }
    }

    // 4. Atomic commit via Lua
    const resultJson = (await redis.eval(
      APPLY_SCRIPT,
      2,
      STATE_KEY(roomId),
      CMDS_KEY(roomId),
      cmd.commandId,
      JSON.stringify(next),
      String(MAX_RECENT_COMMANDS),
    )) as string;

    const result = JSON.parse(resultJson) as {
      duplicate: boolean;
      state: PlaybackState | null;
    };

    if (result.duplicate) {
      if (!result.state) {
        throw new ValidationError("Duplicate command but no state exists");
      }
      return { state: result.state, duplicate: true };
    }

    return { state: result.state as PlaybackState, duplicate: false };
  }

  /** Called when a room is deleted. */
  async clearRoom(roomId: string): Promise<void> {
    await redis.del(STATE_KEY(roomId), CMDS_KEY(roomId));
  }

  /**
   * Expected playback position at time `now`.
   */
  expectedPosition(state: PlaybackState, now: number): number {
    if (state.status === "PAUSED") return state.position;
    const elapsedSec = (now - state.updatedAt) / 1000;
    return Math.max(0, state.position + state.playbackRate * elapsedSec);
  }
}