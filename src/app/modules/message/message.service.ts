import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import CursorQueryBuilder from '../../builder/CursorQueryBuilder';
import { Message } from './message.model';
import { IMessage, ISendMessagePayload } from './message.interface';
import { Chat } from '../chat/chat.model';
import { NotificationBuilder } from '../../../helpers/notification';
import { User } from '../user/user.model';

const sendMessage = async (
  chatId: string,
  senderId: string,
  payload: ISendMessagePayload,
): Promise<IMessage> => {
  const chat = await Chat.findOne({
    _id: chatId,
    participants: senderId,
  }).lean();

  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  // If replying to a specific message, ensure the target message exists within the same chat
  if (payload.replyTo) {
    const referencedMessage = await Message.findOne({
      _id: payload.replyTo,
      chatId: new Types.ObjectId(chatId),
    }).lean();

    if (!referencedMessage) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'Referenced message not found in this chat',
      );
    }
  }

  const rawAttachments =
    payload.attachments ||
    payload.file ||
    payload.image ||
    payload.files;

  const normalizedAttachments: string[] = rawAttachments
    ? Array.isArray(rawAttachments)
      ? rawAttachments
      : [rawAttachments]
    : [];

  const message = await Message.create({ 
    chatId: new Types.ObjectId(chatId),
    sender: new Types.ObjectId(senderId),
    text: payload.text,
    attachments: normalizedAttachments,
    replyTo: payload.replyTo ? new Types.ObjectId(payload.replyTo) : null,
    readBy: [new Types.ObjectId(senderId)],
  });

  let preview = (payload.text || '').trim().substring(0, 100);
  if (!preview && normalizedAttachments.length > 0) {
    preview = 'Attachment';
  }


  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: preview,
    lastMessageAt: message.createdAt,
  });

  const recipientId = chat.participants
    .map(p => p.toString())
    .find(id => id !== senderId);

  if (recipientId) {
    const sender = await User.findById(senderId).select('name profilePicture').lean();

    const previewText = preview.substring(0, 80);
    new NotificationBuilder()
      .to(recipientId)
      .useTemplate('newMessage', {
        senderId: String(senderId),
        senderName: sender?.name || 'Someone',
        senderAvatar: sender?.profilePicture || '',
        messagePreview: previewText,
        preview: previewText,
        chatId,
        messageId: String(message._id),
      })
      .viaPush()
      .viaSocket()
      .viaDatabase()
      .send()
      .catch(() => {});

    const io = global.io;
    if (io) {

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name profilePicture')
        .populate({
          path: 'replyTo',
          select: 'text attachments sender createdAt',
          populate: { path: 'sender', select: 'name profilePicture' },
        })
        .lean();

      io.to(`user::${recipientId}`).emit('NEW_MESSAGE', {
        chatId,
        message: populatedMessage,
      });
    }
  }

  return message;
};

const getMessages = async (
  chatId: string,
  userId: string,
  query: Record<string, unknown>,
) => {
  const chatExists = await Chat.exists({ _id: chatId, participants: userId });
  if (!chatExists) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
  }

  const result = await new CursorQueryBuilder<IMessage>(
    Message.find({ chatId: new Types.ObjectId(chatId) }),
    query,
    { defaultLimit: 20, maxLimit: 100 },
  )
    .cursor('_id', 'desc')
    .search(['text'])
    .populate([
      { path: 'sender', select: 'name profilePicture' },
      {
        path: 'replyTo',
        select: 'text attachments sender createdAt',
        populate: { path: 'sender', select: 'name profilePicture' },
      },
    ])
    .execute();

  // Bounded read-marker: Mark only the returned page of messages as read
  const returnedIds = result.data.map(m => m._id);
  if (returnedIds.length > 0) {
    await Message.updateMany(
      {
        _id: { $in: returnedIds },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
    );
  }

  return {
    cursor: result.cursor,
    data: [...result.data].reverse(),
  };
};

export const MessageService = { sendMessage, getMessages };

