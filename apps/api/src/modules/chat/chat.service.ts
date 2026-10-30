import { ForbiddenError, ValidationError } from "@syncstream/shared-utils";
import { RoomInterface } from "../room/room.interface.js";
import { ChatInterface } from "./chat.interface.js";
import { MessageView } from "./chat.types.js";

const MAX_CONTENT = 2000;
export class ChatService {
  constructor(
    private readonly repo: ChatInterface,
    private readonly rooms: RoomInterface,
  ) { }

  private toView(
    row: Awaited<ReturnType<ChatInterface["create"]>>,
    clientMessageId?: string,
  ): MessageView {
    return {
      id: row.id,
      roomId: row.roomId,
      userId: row.userId,
      name: row.user.name,
      avatarUrl: row.user.avatarUrl,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
    };
  }
  /** Persist then return view. Caller is responsible for broadcasting. */
  async send(userId: string, roomId: string, content: string, clientMessageId?: string) {
    const membership = await this.rooms.findMembership(roomId, userId);
        if (!membership) {
          throw new ForbiddenError("You are not a member of this room");
        }
    
        const trimmed = content.trim();
        if (!trimmed) {
          throw new ValidationError("Message cannot be empty");
        }
        if (trimmed.length > MAX_CONTENT) {
          throw new ValidationError(`Message max length is ${MAX_CONTENT}`);
        }
    
        const row = await this.repo.create({
          roomId,
          userId,
          content: trimmed,
        });
        return this.toView(row, clientMessageId);
  }
  async history(
      userId: string,
      roomId: string,
      opts: { cursor?: string; limit?: number },
    ): Promise<{ messages: MessageView[]; nextCursor: string | null }> {
      const membership = await this.rooms.findMembership(roomId, userId);
      if (!membership) {
        throw new ForbiddenError("You are not a member of this room");
      }
  
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
      const rows = await this.repo.listByRoom(roomId, {
        cursor: opts.cursor,
        limit: limit + 1, // one extra to detect “has more”
      });
  
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor =
        hasMore && page.length > 0
          ? page[page.length - 1]!.createdAt.toISOString()
          : null;
  
      // Return chronological (oldest → newest) for UI convenience
      const messages = page.reverse().map((r) => this.toView(r));
      return { messages, nextCursor };
    }  
}  
