/**
 * Single-process presence:
 * roomId → userId → Set<socketId>
 *
 * Online = at least one socket for that user in the room.
 */
class RoomPresence {
  private readonly rooms = new Map<string, Map<string, Set<string>>>();

  /** socketId → roomIds (for disconnect cleanup) */
  private readonly socketRooms = new Map<string, Set<string>>();

  add(roomId: string, userId: string, socketId: string): void {
    let users = this.rooms.get(roomId);
    if (!users) {
      users = new Map();
      this.rooms.set(roomId, users);
    }
    let sockets = users.get(userId);
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);

    let sr = this.socketRooms.get(socketId);
    if (!sr) {
      sr = new Set();
      this.socketRooms.set(socketId, sr);
    }
    sr.add(roomId);
  }

  /**
   * Remove one socket from a room.
   * @returns true if the user became offline in that room
   */
  remove(roomId: string, userId: string, socketId: string): boolean {
    const users = this.rooms.get(roomId);
    if (!users) return false;

    const sockets = users.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size === 0) {
      users.delete(userId);
      if (users.size === 0) this.rooms.delete(roomId);
      this.unlinkSocketRoom(socketId, roomId);
      return true;
    }
    this.unlinkSocketRoom(socketId, roomId);
    return false;
  }

  /** On disconnect: drop socket from all rooms. Returns rooms where user went offline. */
  removeSocket(
    socketId: string,
    userId: string,
  ): Array<{ roomId: string; userWentOffline: boolean }> {
    const roomIds = this.socketRooms.get(socketId);
    if (!roomIds || roomIds.size === 0) return [];

    const result: Array<{ roomId: string; userWentOffline: boolean }> = [];
    for (const roomId of [...roomIds]) {
      const userWentOffline = this.remove(roomId, userId, socketId);
      result.push({ roomId, userWentOffline });
    }
    this.socketRooms.delete(socketId);
    return result;
  }

  isOnline(roomId: string, userId: string): boolean {
    const sockets = this.rooms.get(roomId)?.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  getOnlineUserIds(roomId: string): Set<string> {
    const users = this.rooms.get(roomId);
    if (!users) return new Set();
    return new Set(users.keys());
  }

  private unlinkSocketRoom(socketId: string, roomId: string) {
    const sr = this.socketRooms.get(socketId);
    if (!sr) return;
    sr.delete(roomId);
    if (sr.size === 0) this.socketRooms.delete(socketId);
  }
}

export const roomPresence = new RoomPresence();