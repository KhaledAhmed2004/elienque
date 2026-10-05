import { model, Schema } from 'mongoose';
import { IMessage, MessageModel } from './message.interface';

const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: false,
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        delete (ret as any).chatId;
        delete (ret as any).readBy;
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  },
);

messageSchema.index({ chatId: 1, _id: -1 });
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, readBy: 1 });

export const Message = model<IMessage, MessageModel>('Message', messageSchema);

