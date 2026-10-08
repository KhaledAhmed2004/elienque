import { model, Schema } from 'mongoose';
import { IDraft, DraftModel } from './draft.interface';

const draftSchema = new Schema<IDraft>(
  {
    targetType: {
      type: String,
      enum: ['BUSINESS_PROFILE', 'CAMPAIGN'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changes: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING',
      required: true,
    },
    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  }
);

// Compound index to ensure only one pending draft per target
draftSchema.index(
  { targetId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

export const Draft = model<IDraft, DraftModel>('Draft', draftSchema);
