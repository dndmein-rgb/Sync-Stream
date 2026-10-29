import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../modules/auth/auth.helper.js";
import { authService } from "../modules/auth/auth.container.js";
import { SafeUser } from "../modules/auth/auth.types.js";
import { logger } from "../config/logger.js";
/**
 * Handshake auth: client must send
 *   io(url, { auth: { token: accessToken } })
 * Do NOT put the token in the query string.
 */
export async function verifySocketIdentity(socket: Socket): Promise<SafeUser> {
  const token =
    (socket.handshake.auth as { token?: string } | undefined)?.token ??
    extractBearer(socket.handshake.headers.authorization);
  if (!token) {
    throw new Error("Unauthorized");
  }

  const payload = verifyAccessToken(token);
  return authService.resolveUser(payload.sub);
}

function extractBearer(header: string | string[] | undefined): string | null {
  if (!header || Array.isArray(header)) return null;
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function registerSocketAuth(io: Server) {
  io.use(async (socket, next) => {
    try {
      const user = await verifySocketIdentity(socket);
      socket.data.user = user;
      next();
    } catch (err) {
      logger.warn("Socket auth failed", {
        socketId: socket.id,
        error: err instanceof Error ? err.message : String(err),
      });

      next(new Error("Unauthorized"));
    }
  });
}
