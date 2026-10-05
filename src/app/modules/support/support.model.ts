import { model, Schema } from 'mongoose';
import { ISupport, ISupportMessage, SupportModel } from './support.interface';
import '../chat/chat.model';

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const supportSchema = new Schema<ISupport>(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    messages: [supportMessageSchema],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

supportSchema.virtual('chat', {
  ref: 'Chat',
  localField: '_id',
  foreignField: 'supportId',
  justOne: true,
});

export const Support = model<ISupport, SupportModel>('Support', supportSchema);
