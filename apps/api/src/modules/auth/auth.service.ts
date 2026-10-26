import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@syncstream/shared-utils";
import { AuthInterface } from "./auth.interface.js";
import { LoginBody, RegisterBody } from "./auth.schema.js";
import bcrypt from "bcryptjs";
import { config } from "../../config/index.js";
import {
  generateRefreshToken,
  hashToken,
  refreshExpiresAt,
  signAccessToken,
} from "./auth.helper.js";
import { SafeUser, TokenPair } from "./auth.types.js";

export class AuthService {
  constructor(private readonly repo: AuthInterface) {}

  async register(input: RegisterBody) {
    const { email, name, password } = input;
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }
    const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
    const user = await this.repo.createUser({
      name,
      email,
      passwordHash,
    });
    const tokens = await this.issueTokens(user.id);
    return { user, tokens };
  }
  async login(input: LoginBody) {
    const user = await this.repo.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await this.issueTokens(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken) {
      throw new ValidationError("refreshToken is required");
    }

    const tokenHash = hashToken(refreshToken);
    const token = await this.repo.findValidRefreshToken(tokenHash);
    if (!token) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Rotate: revoke old, issue new pair
    await this.repo.revokeRefreshToken(token.id);
    return this.issueTokens(token.userId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    const row = await this.repo.findValidRefreshToken(tokenHash);
    if (row) {
      await this.repo.revokeRefreshToken(row.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repo.revokeAllForUser(userId);
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    return user;
  }

  /** Used by HTTP + Socket middleware after JWT verify. */
  async resolveUser(userId: string): Promise<SafeUser> {
    return this.getMe(userId);
  }
  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = signAccessToken(userId);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    await this.repo.createRefreshToken({
      userId,
      tokenHash,
      expiresAt: refreshExpiresAt(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    };
  }
}
