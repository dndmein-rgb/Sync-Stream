import { RoomRole } from "@syncstream/contracts";
import { CreateRoomInput, MemberRecord, RoomRecord, UpdateRoomInput } from "./room.types.js";

export interface RoomInterface {
  createRoomWithHost(data: CreateRoomInput): Promise<RoomRecord>;

  findById(id: string): Promise<RoomRecord | null>;
  findByCode(code: string): Promise<RoomRecord | null>;

  updateRoom(id: string, data: UpdateRoomInput): Promise<RoomRecord>;
  deleteRoom(id: string): Promise<void>;

  countMembers(roomId: string): Promise<number>;
  findMembership(
    roomId: string,
    userId: string,
  ): Promise<{
    userId: string;
    roomId: string;
    role: RoomRole;
    joinedAt: Date;
  } | null>;
  listMembers(roomId: string): Promise<MemberRecord[]>
  /**
     * Atomic join: if not member, enforce capacity then insert VIEWER.
     * Returns membership (existing or new) and whether it was newly created.
     */
  joinAsViewer(userId: string, roomId: string): Promise<{ membership: { role: RoomRole; joinedAt: Date }; created: boolean }>
  removeMember(roomId: string, userId: string): Promise<void>;

  setMemberRole(roomId: string, userId: string, role: RoomRole): Promise<void>
  /**
   * Atomic host transfer:
   * - old host → VIEWER (or CO_HOST if you prefer)
   * - new host → HOST
   * - Room.hostId updated
   */
  transferHost(roomId:string,fromUserId:string,toUserId:string):Promise<void>
}
