import { RefreshToken, User } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";
import { AuthInterface } from "./auth.interface.js";
import { CreateUserData, SafeUser } from "./auth.types.js";

export class AuthRepository implements AuthInterface {
  async createUser(data: CreateUserData): Promise<SafeUser> {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }
  async findById(id: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
  }
  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  }

  async findValidRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      }
    });
  }
  async revokeRefreshToken(id: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
  async revokeAllForUser(userId: string): Promise<{ count: number }> {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
