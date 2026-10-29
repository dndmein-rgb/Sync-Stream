import crypto from "node:crypto";

/** Unambiguous alphabet (no 0/O, 1/I/L). ~8 chars ≈ 40 bits. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateRoomCode(length = 8):string {
  const bytes = crypto.randomBytes(length)
  let code = "";
    for (let i = 0; i < length; i++) {
      code += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    return code;
}
export function socketRoomName(roomId: string): string {
  return `room:${roomId}`;
}