import { Model, Types } from 'mongoose';
import { RECEIPT_STATUS } from '../../../enums/reward';

export type IReceipt = {
  promoterId: Types.ObjectId;
  campaignId: Types.ObjectId;
  fileUrl: string;
  status: RECEIPT_STATUS;
  amountEarned?: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
};

export type ReceiptModel = Model<IReceipt>;
