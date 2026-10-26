import { asyncHandler } from "@syncstream/shared-utils";
import type { Request, Response } from "express";
import type { LoginBody, RefreshBody, RegisterBody } from "./auth.schema.js";
import { authService } from "./auth.container.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterBody;
  const result = await authService.register(body);
  res.status(201).json({
    success: true,
    message: "Registered successfully",
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginBody;
  const result = await authService.login(body);
  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: result,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RefreshBody;
  const tokens = await authService.refresh(body.refreshToken);
  res.status(200).json({
    success: true,
    data: tokens,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<RefreshBody>;
  await authService.logout(body.refreshToken);
  res.status(200).json({ success: true, message: "Logged out" });
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutAll(req.user!.id);
  res.status(200).json({ success: true, message: "Logged out from all sessions" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json({ success: true, data: user });
});