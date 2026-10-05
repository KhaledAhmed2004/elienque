import { Model, Types } from 'mongoose';

export type IMessage = {
  _id?: Types.ObjectId;
  id?: string;
  chatId: Types.ObjectId;
  sender: Types.ObjectId;
  text?: string;
  attachments?: string[];
  replyTo?: Types.ObjectId | IMessage;
  readBy?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
};


export type ISendMessagePayload = {
  text?: string;
  attachments?: string | string[];
  file?: string | string[];
  image?: string | string[];
  files?: string | string[];
  replyTo?: string;
};

export type MessageModel = Model<IMessage>;

