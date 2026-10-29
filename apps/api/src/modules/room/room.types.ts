import { RoomRole, RoomVisibility } from "@syncstream/contracts";

export type CreateRoomInput = {
  name: string;
  visibility?: RoomVisibility;
  maxMembers?:number
  hostId:string
}

export type UpdateRoomInput = {
  name?: string;
  visibility?: RoomVisibility;
  maxMembers?: number;
};

export type RoomRecord = {
  id: string;
    code: string;
    name: string;
    visibility: RoomVisibility;
    hostId: string;
    maxMembers: number;
    createdAt: Date;
    updatedAt: Date;
}

export type MemberRecord = {
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: Date;
  user: {
    id: string;
        name: string;
        avatarUrl: string | null;
    }
}

export type RoomView = {
  id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  hostId: string;
  maxMembers: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  myRole?: RoomRole;
};

export type MemberView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: RoomRole;
  online: boolean;
  joinedAt: string;
};