import { RoomRepository } from "./room.repository.js";
import { RoomService } from "./room.service.js";
import { roomPresence } from "../../realtime/room-presence.js";

const roomRepository = new RoomRepository();
export const roomService = new RoomService(roomRepository, roomPresence);