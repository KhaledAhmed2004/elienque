import { Model, Types } from 'mongoose';

export type ISupportMessage = {
  sender: Types.ObjectId;
  message: string;
  createdAt?: Date;
};

export type ISupport = {
  subject: string;
  user: Types.ObjectId;
  messages: ISupportMessage[];
  chat?: Types.ObjectId | { _id: Types.ObjectId };
  createdAt?: Date;
  updatedAt?: Date;
};

export type SupportModel = Model<ISupport>;
