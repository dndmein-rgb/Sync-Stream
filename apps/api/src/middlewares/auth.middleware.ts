import { UnauthorizedError } from "@syncstream/shared-utils";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";
import { authService } from "../modules/auth/auth.container.js";
import { verifyAccessToken } from "../modules/auth/auth.helper.js";



export const authenticate = async(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(
        new UnauthorizedError("Authentication required"),
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      return next(
        new UnauthorizedError(
          "Invalid authentication header format",
        ),
      );
    }

    const accessToken = authHeader.split(" ")[1];

    if (!accessToken) {
      return next(
        new UnauthorizedError("Access token missing"),
      );
    }
    const payload = verifyAccessToken(accessToken);
  const user=await authService.resolveUser(payload.sub)

    req.user = user

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        new UnauthorizedError("Access token expired"),
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new UnauthorizedError("Invalid access token"),
      );
    }

    return next(error);
  }
};