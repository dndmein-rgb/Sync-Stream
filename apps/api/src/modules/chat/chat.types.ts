export type CreateMessageInput = {
  roomId: string;
  userId: string;
  content:string
}

export type MessageRecord = {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name:  string;
    avatarUrl:string|null
  }
  
}

export type MessageView={
  id: string;
  roomId: string;
  userId: string;
  name: string;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
    clientMessageId?: string;
}