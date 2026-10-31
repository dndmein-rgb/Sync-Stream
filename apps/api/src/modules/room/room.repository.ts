import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@syncstream/shared-utils";
import { prisma } from "../../infrastructure/prisma.js";
import type { RoomInterface } from "./room.interface.js";
import type {
  CreateRoomInput,
  MemberRecord,
  RoomRecord,
  UpdateRoomInput,
} from "./room.types.js";
import type { RoomRole } from "@syncstream/contracts";
import { generateRoomCode } from "./room.helper.js";

function toRoomRecord(row: {
  id: string;
  code: string;
  name: string;
  visibility: string;
  hostId: string;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}): RoomRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    visibility: row.visibility as RoomRecord["visibility"],
    hostId: row.hostId,
    maxMembers: row.maxMembers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class RoomRepository implements RoomInterface {
  async createRoomWithHost(data: CreateRoomInput): Promise<RoomRecord> {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateRoomCode(8);
      try {
        const room = await prisma.$transaction(async (tx) => {
          const created = await tx.room.create({
            data: {
              code,
              name: data.name,
              visibility: data.visibility ?? "PRIVATE",
              hostId: data.hostId,
              maxMembers: data.maxMembers ?? 10,
              members: {
                create: {
                  userId: data.hostId,
                  role: "HOST",
                },
              },
            },
          });
          return created;
        });
        return toRoomRecord(room);
      } catch (err: unknown) {
        // Unique violation on code — retry
        const codeConflict =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "P2002";
        if (codeConflict && attempt < maxAttempts - 1) continue;
        throw err;
      }
    }
    throw new ConflictError("Could not allocate a unique room code");
  }

  async findById(id: string): Promise<RoomRecord | null> {
    const row = await prisma.room.findUnique({ where: { id } });
    return row ? toRoomRecord(row) : null;
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    const row = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
    });
    return row ? toRoomRecord(row) : null;
  }

  async updateRoom(id: string, data: UpdateRoomInput): Promise<RoomRecord> {
    const row = await prisma.room.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.maxMembers !== undefined ? { maxMembers: data.maxMembers } : {}),
      },
    });
    return toRoomRecord(row);
  }

  async deleteRoom(id: string): Promise<void> {
    await prisma.room.delete({ where: { id } });
  }

  async countMembers(roomId: string): Promise<number> {
    return prisma.roomMember.count({ where: { roomId } });
  }

  async findMembership(roomId: string, userId: string) {
    return prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { roomId: true, userId: true, role: true, joinedAt: true },
    });
  }

  async listMembers(roomId: string): Promise<MemberRecord[]> {
    const rows = await prisma.roomMember.findMany({
      where: { roomId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
    return rows.map((r) => ({
      roomId: r.roomId,
      userId: r.userId,
      role: r.role as RoomRole,
      joinedAt: r.joinedAt,
      user: r.user,
    }));
  }

  async joinAsViewer(
    roomId: string,
    userId: string,
  ): Promise<{ membership: { role: RoomRole; joinedAt: Date }; created: boolean }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (existing) {
        return {
          membership: {
            role: existing.role as RoomRole,
            joinedAt: existing.joinedAt,
          },
          created: false,
        };
      }

      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new NotFoundError("Room", roomId);
      }

      const count = await tx.roomMember.count({ where: { roomId } });
      if (count >= room.maxMembers) {
        throw new ConflictError("Room is full");
      }

      const created = await tx.roomMember.create({
        data: {
          roomId,
          userId,
          role: "VIEWER",
        },
      });

      return {
        membership: {
          role: created.role as RoomRole,
          joinedAt: created.joinedAt,
        },
        created: true,
      };
    });
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  async setMemberRole(roomId: string, userId: string, role: RoomRole): Promise<void> {
    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data:{role}
    })
  }
  async transferHost(roomId: string, fromUserId: string, toUserId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId } });
          if (!room) throw new NotFoundError("Room", roomId);
          if (room.hostId !== fromUserId) {
            throw new ForbiddenError("Only the current host can transfer");
          }
      
          const target = await tx.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId: toUserId } },
          });
          if (!target) {
            throw new NotFoundError("Member", toUserId);
      }
      await tx.roomMember.update({
            where: { roomId_userId: { roomId, userId: fromUserId } },
            data: { role: "VIEWER" },
          });
          await tx.roomMember.update({
            where: { roomId_userId: { roomId, userId: toUserId } },
            data: { role: "HOST" },
          });
          await tx.room.update({
            where: { id: roomId },
            data: { hostId: toUserId },
          });
    })
  }
}