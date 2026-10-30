import { prisma } from "../../infrastructure/prisma.js";
import { ChatInterface } from "./chat.interface.js";
import { CreateMessageInput, MessageRecord } from "./chat.types.js";

export class ChatRepository implements ChatInterface {
  async create(data: CreateMessageInput): Promise<MessageRecord> {
    return prisma.chatMessage.create({
      data: {
        content: data.content,
        roomId: data.roomId,
        userId: data.userId,
      },
      include: {
        user: {
          select: {
            avatarUrl: true,
            id: true,
            name: true,
          },
        },
      },
    });
  }
  async listByRoom(
    roomId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<MessageRecord[]> {
    return prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(opts.cursor ? { createdAt: { lt: new Date(opts.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }
}
