import { Model, Types } from 'mongoose';
import { SESSION_STATUS } from '../../../enums/user';

export type ISession = {
  userId: Types.ObjectId; // Reference to User
  familyId: string; // UUID v4
  hashedRefreshToken: string;
  previousHashedToken?: string;
  rotatedAt?: Date;
  status: SESSION_STATUS;
  absoluteExpiresAt: Date;
  lastActiveAt: Date;
};

export type SessionModel = Model<ISession>;
