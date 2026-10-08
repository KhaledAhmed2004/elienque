import { model, Schema } from 'mongoose';
import { IReceipt, ReceiptModel } from './receipt.interface';
import { RECEIPT_STATUS } from '../../../enums/reward';

const receiptSchema = new Schema<IReceipt>(
  {
    promoterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RECEIPT_STATUS),
      default: RECEIPT_STATUS.PENDING,
    },
    amountEarned: {
      type: Number,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  },
);

receiptSchema.index({ promoterId: 1, campaignId: 1 });
receiptSchema.index({ status: 1 });

export const Receipt = model<IReceipt, ReceiptModel>('Receipt', receiptSchema);
