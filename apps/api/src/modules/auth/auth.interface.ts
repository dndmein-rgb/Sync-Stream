import { RefreshToken, User } from "../../generated/prisma/client.js";
import { CreateUserData, SafeUser } from "./auth.types.js";

export interface AuthInterface{
  createUser(data: CreateUserData): Promise<SafeUser>
  findById(id:string):Promise<SafeUser|null>
  findByEmail(email: string): Promise<User | null>
  createRefreshToken(data: { userId: string, tokenHash: string, expiresAt: Date }): Promise<RefreshToken>
  findValidRefreshToken(tokenHash: string): Promise<RefreshToken | null>
  revokeRefreshToken(id: string): Promise<RefreshToken | null>
  revokeAllForUser(userId:string):Promise<{count:number}>
}