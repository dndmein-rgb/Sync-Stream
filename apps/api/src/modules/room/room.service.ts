import { RoomRole } from "@syncstream/contracts";
import { RoomInterface } from "./room.interface.js";
import { MemberView, RoomView } from "./room.types.js";
import { CreateRoomBody, JoinByCodeBody, JoinByIdBody, UpdateRoomBody } from "./room.schema.js";
import { ForbiddenError, NotFoundError, ValidationError } from "@syncstream/shared-utils";

export type PresencePort = {
  isOnline(roomId: string, userId: string): boolean;
  getOnlineUserIds(roomId: string): Set<string>;
};

export class RoomService {
  constructor(
    private readonly repo: RoomInterface,
    private readonly presence: PresencePort,
  ) { }

  private toRoomView(
    room: {
      id: string;
      code: string;
      name: string;
      visibility: RoomView["visibility"];
      hostId: string;
      maxMembers: number;
      createdAt: Date;
      updatedAt: Date;
    },
    memberCount: number,
    myRole?: RoomRole,
  ): RoomView {
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      visibility: room.visibility,
      hostId: room.hostId,
      maxMembers: room.maxMembers,
      memberCount,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      ...(myRole ? { myRole } : {}),
    };
  }

  private toMemberViews(
    roomId: string,
    members: Awaited<ReturnType<RoomInterface["listMembers"]>>,
  ): MemberView[] {
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      online: this.presence.isOnline(roomId, m.userId),
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async create(hostId: string, body: CreateRoomBody) {
    const room = await this.repo.createRoomWithHost({
      hostId,
      name: body.name,
      maxMembers: body.maxMembers,
      visibility: body.visibility,
    });
    return this.toRoomView(room, 1, "HOST");
  }
  async getById(roomId: string, requesterId: string) {
    const room = await this.repo.findById(roomId);
    if (!room) {
      if (!room) throw new NotFoundError("Room", roomId);
    }
    const membership = await this.repo.findMembership(roomId, requesterId);
    if (!membership) {
      throw new ForbiddenError("You are not a member of this room");
    }
    const count = await this.repo.countMembers(roomId);
    return this.toRoomView(room, count, membership.role);
  }
  async getMembers(roomId: string, requesterId: string): Promise<MemberView[]> {
    const membership = await this.repo.findMembership(roomId, requesterId);
    if (!membership) {
      throw new ForbiddenError("You are not a member of this room");
    }
    const members = await this.repo.listMembers(roomId);
    return this.toMemberViews(roomId, members);
  }

  /**
   * Shared join logic for HTTP + sockets.
   * Private rooms require correct code unless already a member.
   */
  async join(
    userId: string,
    opts: { roomId?: string; code?: string },
  ): Promise<{ room: RoomView; members: MemberView[]; created: boolean }> {
    let room =
      opts.roomId != null
        ? await this.repo.findById(opts.roomId)
        : opts.code != null
          ? await this.repo.findByCode(opts.code)
          : null;
    if (!room && opts.code && opts.roomId) {
      // join by id + verify code
      room = await this.repo.findById(opts.roomId);
    }
    if (!room) throw new NotFoundError("Room");
    const existing = await this.repo.findMembership(room.id, userId);
    
    if (!existing) {
      if (room.visibility === "PRIVATE") {
        const code = opts.code?.toUpperCase();
        if (!code || code !== room.code) {
          throw new ForbiddenError("Valid room code required");
        }
      }
      const { membership, created } = await this.repo.joinAsViewer(room.id, userId);
      const count = await this.repo.countMembers(room.id);
      const members = this.toMemberViews(room.id, await this.repo.listMembers(room.id));
      return {
        room: this.toRoomView(room, count, membership.role),
        members,
        created,
      };
    }
    // Already member — idempotent (reconnect-friendly)
        if (
          room.visibility === "PRIVATE" &&
          opts.code &&
          opts.code.toUpperCase() !== room.code
        ) {
          // optional: still allow if already member even with wrong code
        }
        const count = await this.repo.countMembers(room.id);
            const members = this.toMemberViews(room.id, await this.repo.listMembers(room.id));
            return {
              room: this.toRoomView(room, count, existing.role),
              members,
              created: false,
            };
  }
  async joinByCode(userId: string, body: JoinByCodeBody) {
      return this.join(userId, { code: body.code });
    }
  
    async joinById(userId: string, roomId: string, body: JoinByIdBody) {
      return this.join(userId, { roomId, code: body.code });
    }

  async leave(userId: string, roomId: string) {
    const room = await this.repo.findById(roomId);
        if (!room) throw new NotFoundError("Room", roomId);
    
        const membership = await this.repo.findMembership(roomId, userId);
        if (!membership) {
          return; // idempotent
        }
        if (membership.role === "HOST") {
              throw new ForbiddenError(
                "Host cannot leave; transfer host or delete the room",
              );
            }
        
       

    await this.repo.removeMember(roomId, userId);
  }

  async update(roomId:string,userId:string,body:UpdateRoomBody) {
    const room = await this.repo.findById(roomId);
        if (!room) throw new NotFoundError("Room", roomId);
    
        const membership = await this.repo.findMembership(roomId, userId);
        if (!membership || membership.role !== "HOST") {
          throw new ForbiddenError("Only the host can update room settings");
        }
        if (body.maxMembers !== undefined) {
              const count = await this.repo.countMembers(roomId);
              if (body.maxMembers < count) {
                throw new ValidationError(
                  `maxMembers cannot be less than current member count (${count})`,
                );
              }
        }
        const updated = await this.repo.updateRoom(roomId, body);
            const count = await this.repo.countMembers(roomId);
            return this.toRoomView(updated, count, "HOST");
  }
  async remove(userId: string, roomId: string) {
      const room = await this.repo.findById(roomId);
      if (!room) throw new NotFoundError("Room", roomId);
  
      if (room.hostId !== userId) {
        throw new ForbiddenError("Only the host can delete the room");
      }
  
      await this.repo.deleteRoom(roomId);
  }
  /** Used by socket layer after membership is confirmed. */
    async assertMember(roomId: string, userId: string) {
      const membership = await this.repo.findMembership(roomId, userId);
      if (!membership) {
        throw new ForbiddenError("You are not a member of this room");
      }
      return membership;
    }
  
    async buildMemberList(roomId: string): Promise<MemberView[]> {
      const members = await this.repo.listMembers(roomId);
      return this.toMemberViews(roomId, members);
    }
}  
