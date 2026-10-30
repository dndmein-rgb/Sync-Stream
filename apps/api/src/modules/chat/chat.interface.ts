import type { CreateMessageInput, MessageRecord } from "./chat.types.js";

export interface ChatInterface {
  create(data: CreateMessageInput): Promise<MessageRecord>;
  /**
   * Newest-first page. If `cursor` is set, return messages strictly older than it.
   */
  listByRoom(
    roomId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<MessageRecord[]>;
}
