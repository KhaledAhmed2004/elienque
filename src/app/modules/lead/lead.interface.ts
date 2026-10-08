import { Document, Types } from 'mongoose';

export enum LeadStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IBusinessLead extends Document {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  promoterId: Types.ObjectId;
  userId?: Types.ObjectId;
  status: LeadStatus;
  adminNote?: string;
  rejectReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
