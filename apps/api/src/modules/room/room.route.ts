import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  CreateRoomBodySchema,
  JoinByCodeBodySchema,
  JoinByIdBodySchema,
  RoomIdParamsSchema,
  UpdateRoomBodySchema,
} from "./room.schema.js";
import {
  createRoom,
  deleteRoom,
  getRoom,
  getRoomMembers,
  joinByCode,
  joinById,
  leaveRoom,
  updateRoom,
} from "./room.controller.js";
import { asyncHandler } from "@syncstream/shared-utils";
import { chatService } from "../chat/chat.container.js";

const router = Router();

router.use(authenticate);

router.post("/", validate(CreateRoomBodySchema), createRoom);
router.post("/join", validate(JoinByCodeBodySchema), joinByCode);

router.get(
  "/:id",
  validate(RoomIdParamsSchema, "params"),
  getRoom,
);
router.get(
  "/:id/members",
  validate(RoomIdParamsSchema, "params"),
  getRoomMembers,
);
router.post(
  "/:id/join",
  validate(RoomIdParamsSchema, "params"),
  validate(JoinByIdBodySchema),
  joinById,
);
router.post(
  "/:id/leave",
  validate(RoomIdParamsSchema, "params"),
  leaveRoom,
);
router.patch(
  "/:id",
  validate(RoomIdParamsSchema, "params"),
  validate(UpdateRoomBodySchema),
  updateRoom,
);
router.delete(
  "/:id",
  validate(RoomIdParamsSchema, "params"),
  deleteRoom,
);


router.get(
  "/:id/messages",
  validate(RoomIdParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await chatService.history(req.user!.id, id, { cursor, limit });
    res.status(200).json({ success: true, data: result });
  }),
);

export default router;
