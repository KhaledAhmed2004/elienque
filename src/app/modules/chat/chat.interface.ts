import { Model, Types } from 'mongoose';

export type IChat = {
  _id?: Types.ObjectId;
  conversationKey?: string;
  participants: Types.ObjectId[];
  itemId?: Types.ObjectId | null;
  jobId?: Types.ObjectId | null;
  supportId?: Types.ObjectId | null;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IChatParticipant = {
  _id: Types.ObjectId;
  id?: string;
  name: string;
  email?: string;
  profilePicture?: string;
};

export type IChatWithUnread = IChat & {
  id?: string;
  unreadCount: number;
  isRead: boolean;
};

export type ChatModel = Model<IChat>;

