import { Model, Types } from 'mongoose';
import { CASH_OUT_STATUS } from '../../../enums/reward';

export type ICashOutRequest = {
  promoterId: Types.ObjectId;
  amount: number;
  paymentMethod: string;
  paymentDetails: Record<string, string>;
  status: CASH_OUT_STATUS;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  rejectionReason?: string;
  transactionReference?: string;
};

export type CashOutRequestModel = Model<ICashOutRequest>;
