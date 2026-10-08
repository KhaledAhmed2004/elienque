import { Document, Types, Model } from 'mongoose';

export type ITargetType = 'BUSINESS_PROFILE' | 'CAMPAIGN';
export type IDraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface IDraft extends Document {
  targetType: ITargetType;
  targetId: Types.ObjectId;
  adminId: Types.ObjectId;
  ownerId: Types.ObjectId;
  changes: Record<string, any>;
  status: IDraftStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DraftModel = Model<IDraft, Record<string, unknown>>;
