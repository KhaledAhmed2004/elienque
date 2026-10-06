import { Document, Types } from 'mongoose';

export enum LeadStatus {
  PENDING = 'PENDING',
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
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
}
