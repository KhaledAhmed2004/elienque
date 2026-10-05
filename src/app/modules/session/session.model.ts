import { Schema, model } from 'mongoose';
import { SESSION_STATUS } from '../../../enums/user';
import { ISession, SessionModel } from './session.interface';

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    familyId: { type: String, required: true, unique: true },
    hashedRefreshToken: { type: String, required: true },
    previousHashedToken: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
    },
    absoluteExpiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const Session = model<ISession, SessionModel>('Session', sessionSchema);
