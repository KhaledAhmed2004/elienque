import { model, Schema } from 'mongoose';
import { IChat, ChatModel } from './chat.interface';

const chatSchema = new Schema<IChat, ChatModel>(
  {
    conversationKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (v: Schema.Types.ObjectId[]) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v[0]?.toString() !== v[1]?.toString(),
        message: 'Chat must have exactly 2 distinct participants',
      },
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    supportId: {
      type: Schema.Types.ObjectId,
      ref: 'Support',
      default: null,
    },
    lastMessage: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        delete (ret as any).createdBy;
        delete (ret as any).conversationKey;
        if (!ret.itemId) {
          delete (ret as any).itemId;
        } else if (typeof ret.itemId === 'object') {
          delete (ret.itemId as any).__v;
          (ret.itemId as any).id = (ret.itemId as any)._id || (ret.itemId as any).id;
          delete (ret.itemId as any)._id;
        }
        if (!ret.jobId) {
          delete (ret as any).jobId;
        } else if (typeof ret.jobId === 'object') {
          delete (ret.jobId as any).__v;
          delete (ret.jobId as any).hasReview;
          delete (ret.jobId as any).isReviewedByCreator;
          delete (ret.jobId as any).isReviewedByDriver;
          (ret.jobId as any).id = (ret.jobId as any)._id || (ret.jobId as any).id;
          delete (ret.jobId as any)._id;
        }
        if (!ret.supportId) {
          delete (ret as any).supportId;
        } else if (typeof ret.supportId === 'object') {
          delete (ret.supportId as any).__v;
          (ret.supportId as any).id = (ret.supportId as any)._id || (ret.supportId as any).id;
          delete (ret.supportId as any)._id;
        }
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  },
);

// Compound index for user chat listing + sorting
chatSchema.index({ participants: 1, lastMessageAt: -1 });
chatSchema.index({ lastMessageAt: -1 });

export const Chat = model<IChat, ChatModel>('Chat', chatSchema);

