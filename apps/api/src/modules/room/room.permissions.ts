import type { RoomRole } from "@syncstream/contracts";
import { ForbiddenError } from "@syncstream/shared-utils";

export type RoomAction =
  | "PLAYBACK_CONTROL"   // play / pause / seek / change video
  | "SEND_CHAT"
  | "SEND_REACTION"
  | "UPDATE_ROOM"
  | "DELETE_ROOM"
  | "REMOVE_MEMBER"
  | "CHANGE_ROLE"        // promote / demote
  | "TRANSFER_HOST"
  | "LEAVE_ROOM";


  const MATRIX: Record<RoomAction, readonly RoomRole[]> = {
    PLAYBACK_CONTROL: ["HOST", "CO_HOST"],
    SEND_CHAT: ["HOST", "CO_HOST", "VIEWER"],
    SEND_REACTION: ["HOST", "CO_HOST", "VIEWER"],
    UPDATE_ROOM: ["HOST"],
    DELETE_ROOM: ["HOST"],
    REMOVE_MEMBER: ["HOST"],
    CHANGE_ROLE: ["HOST"],
    TRANSFER_HOST: ["HOST"],
    LEAVE_ROOM: ["CO_HOST", "VIEWER"], // host must transfer or delete
};

  export function can(role: RoomRole, action: RoomAction): boolean {
    return MATRIX[action].includes(role);
  }
  
  export function assertCan(role: RoomRole, action: RoomAction): void {
    if (!can(role, action)) {
      throw new ForbiddenError(`Role ${role} cannot perform ${action}`);
    }
  }