/**
 * Multi-instance presence backed by Redis.
 *
 * Key layout:
 *   presence:room:{roomId}          Hash  → userId → JSON({ sockets: string[], lastSeen: number })
 *   presence:socket:{socketId}      Set   → roomIds this socket belongs to
 *
 * A user is considered online in a room while their entry still contains
 * at least one live socketId.
 */

import { redis } from "../../infrastructure/redis.js";
import { logger } from "../../config/logger.js";

const ROOM_KEY = (roomId: string) => `presence:room:${roomId}`;
const SOCKET_KEY = (socketId: string) => `presence:socket:${socketId}`;

type PresenceEntry = {
  sockets: string[];
  lastSeen: number;
};

class RoomPresence {
  async add(roomId: string, userId: string, socketId: string): Promise<void> {
    const key = ROOM_KEY(roomId);
    const raw = await redis.hget(key, userId);
    const data: PresenceEntry = raw
      ? JSON.parse(raw)
      : { sockets: [], lastSeen: Date.now() };

    if (!data.sockets.includes(socketId)) {
      data.sockets.push(socketId);
    }
    data.lastSeen = Date.now();

    await redis
      .multi()
      .hset(key, userId, JSON.stringify(data))
      .sadd(SOCKET_KEY(socketId), roomId)
      .exec();
  }

  /**
   * Remove one socket from a room.
   * @returns true if the user became offline in that room
   */
  async remove(
    roomId: string,
    userId: string,
    socketId: string,
  ): Promise<boolean> {
    const key = ROOM_KEY(roomId);
    const raw = await redis.hget(key, userId);
    if (!raw) return false;

    const data: PresenceEntry = JSON.parse(raw);
    data.sockets = data.sockets.filter((s) => s !== socketId);

    const pipeline = redis.multi();
    pipeline.srem(SOCKET_KEY(socketId), roomId);

    if (data.sockets.length === 0) {
      pipeline.hdel(key, userId);
      await pipeline.exec();
      return true; // user went offline
    }

    data.lastSeen = Date.now();
    pipeline.hset(key, userId, JSON.stringify(data));
    await pipeline.exec();
    return false;
  }

  /**
   * On disconnect: drop the socket from every room it was in.
   * Returns the list of rooms where the user became offline.
   */
  async removeSocket(
    socketId: string,
    userId: string,
  ): Promise<Array<{ roomId: string; userWentOffline: boolean }>> {
    const roomIds = await redis.smembers(SOCKET_KEY(socketId));
    if (roomIds.length === 0) return [];

    const result: Array<{ roomId: string; userWentOffline: boolean }> = [];

    for (const roomId of roomIds) {
      const userWentOffline = await this.remove(roomId, userId, socketId);
      result.push({ roomId, userWentOffline });
    }

    // clean up the socket key itself
    await redis.del(SOCKET_KEY(socketId));
    return result;
  }

  async isOnline(roomId: string, userId: string): Promise<boolean> {
    const raw = await redis.hget(ROOM_KEY(roomId), userId);
    if (!raw) return false;
    const data: PresenceEntry = JSON.parse(raw);
    return data.sockets.length > 0;
  }

  async getOnlineUserIds(roomId: string): Promise<Set<string>> {
    const all = await redis.hgetall(ROOM_KEY(roomId));
    return new Set(Object.keys(all));
  }

  /** Debug helper – not used in production paths */
  async debugRoom(roomId: string): Promise<Record<string, PresenceEntry>> {
    const all = await redis.hgetall(ROOM_KEY(roomId));
    const out: Record<string, PresenceEntry> = {};
    for (const [uid, raw] of Object.entries(all)) {
      out[uid] = JSON.parse(raw);
    }
    return out;
  }
}

export const roomPresence = new RoomPresence();