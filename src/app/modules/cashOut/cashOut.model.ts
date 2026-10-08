import { model, Schema } from 'mongoose';
import { ICashOutRequest, CashOutRequestModel } from './cashOut.interface';
import { CASH_OUT_STATUS } from '../../../enums/reward';

const cashOutRequestSchema = new Schema<ICashOutRequest>(
  {
    promoterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 50, // Enforce $50 minimum at DB schema level
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentDetails: {
      type: Object, // Stores schema-less object for diverse methods like { email: '...', account: '...' }
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CASH_OUT_STATUS),
      default: CASH_OUT_STATUS.PENDING,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    transactionReference: {
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

cashOutRequestSchema.index({ promoterId: 1, status: 1 });
cashOutRequestSchema.index({ status: 1 });

export const CashOutRequest = model<ICashOutRequest, CashOutRequestModel>(
  'CashOutRequest',
  cashOutRequestSchema
);
