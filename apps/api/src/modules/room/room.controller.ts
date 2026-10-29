import { asyncHandler } from "@syncstream/shared-utils";
import type { Request, Response } from "express";
import { roomService } from "./room.container.js";
import type {
  CreateRoomBody,
  JoinByCodeBody,
  JoinByIdBody,
  RoomIdParams,
  UpdateRoomBody,
} from "./room.schema.js";

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateRoomBody;
  const room = await roomService.create(req.user!.id, body);
  res.status(201).json({
    success: true,
    message: "Room created",
    data: room,
  });
});

export const getRoom = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  const room = await roomService.getById(id, req.user!.id);
  res.status(200).json({ success: true, data: room });
});

export const getRoomMembers = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  const members = await roomService.getMembers(id, req.user!.id);
  res.status(200).json({ success: true, data: members });
});

export const joinById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  const body = req.body as JoinByIdBody;
  const result = await roomService.joinById(req.user!.id, id, body);
  res.status(200).json({
    success: true,
    message: result.created ? "Joined room" : "Already a member",
    data: result,
  });
});

export const joinByCode = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as JoinByCodeBody;
  const result = await roomService.joinByCode(req.user!.id, body);
  res.status(200).json({
    success: true,
    message: result.created ? "Joined room" : "Already a member",
    data: result,
  });
});

export const leaveRoom = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  await roomService.leave(req.user!.id, id);
  res.status(200).json({ success: true, message: "Left room" });
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  const body = req.body as UpdateRoomBody;
  const room = await roomService.update(req.user!.id, id, body);
  res.status(200).json({ success: true, data: room });
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as RoomIdParams;
  await roomService.remove(req.user!.id, id);
  res.status(200).json({ success: true, message: "Room deleted" });
});