import { ChatRepository } from "./chat.repository.js";
import { ChatService } from "./chat.service.js";
import { RoomRepository } from "../room/room.repository.js";

const chatRepository = new ChatRepository();
const roomRepository = new RoomRepository(); 

export const chatService = new ChatService(chatRepository, roomRepository);