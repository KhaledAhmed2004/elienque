import { StatusCodes } from 'http-status-codes';
import mongoose, { FilterQuery, Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Chat } from './chat.model';
import { IChat, IChatWithUnread } from './chat.interface';
import { Message } from '../message/message.model';
import { User } from '../user/user.model';
import { Item } from '../item/item.model';

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const JOB_POPULATE_FIELDS =
  'jobType pickup dropoff date time paymentAmount status';

const getOrCreateChat = async (
  requesterId: string,
  participantId: string,
  options: { itemId?: string; jobId?: string; supportId?: string } = {},
): Promise<IChat> => {
  if (requesterId === participantId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You cannot start a chat with yourself',
    );
  }

  const sortedParticipants = [requesterId, participantId].sort();
  const conversationKey = sortedParticipants.join('_');

  // Search for any existing chat matching conversationKey or participants
  const queryConditions: any[] = [
    { conversationKey },
    {
      participants: {
        $all: [
          new Types.ObjectId(requesterId),
          new Types.ObjectId(participantId),
        ],
      },
    },
  ];

  let chat = await Chat.findOne({ $or: queryConditions });

  if (chat) {
    let needsSave = false;
    // Backfill conversationKey if missing on legacy documents
    if (!chat.conversationKey) {
      chat.conversationKey = conversationKey;
      needsSave = true;
    }
    if (
      options.jobId &&
      Types.ObjectId.isValid(options.jobId) &&
      chat.jobId?.toString() !== options.jobId
    ) {
      chat.jobId = new Types.ObjectId(options.jobId);
      needsSave = true;
    }
    if (
      options.itemId &&
      Types.ObjectId.isValid(options.itemId) &&
      chat.itemId?.toString() !== options.itemId
    ) {
      chat.itemId = new Types.ObjectId(options.itemId);
      needsSave = true;
    }
    if (
      options.supportId &&
      Types.ObjectId.isValid(options.supportId) &&
      chat.supportId?.toString() !== options.supportId
    ) {
      chat.supportId = new Types.ObjectId(options.supportId);
      needsSave = true;
    }
    if (needsSave) {
      try {
        await chat.save();
      } catch (e) {
        // If unique constraint conflicts on save, ignore and continue returning the chat
      }
    }

    return Chat.findById(chat._id)
      .populate('participants', 'name profilePicture')
      .populate('itemId', 'title photos price status')
      .populate('jobId', JOB_POPULATE_FIELDS)
      .populate('supportId', 'subject') as any;
  }

  try {
    chat = await Chat.create({
      conversationKey,
      participants: sortedParticipants.map(id => new Types.ObjectId(id)),
      ...(options.itemId &&
        Types.ObjectId.isValid(options.itemId) && {
          itemId: new Types.ObjectId(options.itemId),
        }),
      ...(options.jobId &&
        Types.ObjectId.isValid(options.jobId) && {
          jobId: new Types.ObjectId(options.jobId),
        }),
      ...(options.supportId &&
        Types.ObjectId.isValid(options.supportId) && {
          supportId: new Types.ObjectId(options.supportId),
        }),
      createdBy: new Types.ObjectId(requesterId),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      // If a collision happens, safely find and return the existing chat
      chat = await Chat.findOne({
        $or: [
          { conversationKey },
          {
            participants: {
              $all: [
                new Types.ObjectId(requesterId),
                new Types.ObjectId(participantId),
              ],
            },
          },
        ],
      });
      if (!chat) throw err;
    } else {
      throw err;
    }
  }

  return Chat.findById(chat!._id)
    .populate('participants', 'name profilePicture')
    .populate('itemId', 'title photos price status')
    .populate('jobId', JOB_POPULATE_FIELDS)
    .populate('supportId', 'subject') as any;
};

const getMyChats = async (
  userId: string,
  query?: Record<string, unknown>,
): Promise<IChatWithUnread[]> => {
  const filterQuery: FilterQuery<IChat> = {
    participants: new Types.ObjectId(userId),
  };

  const rawSearch = query?.searchTerm;
  const searchTerm =
    typeof rawSearch === 'string' ? rawSearch.trim() : undefined;

  if (searchTerm && searchTerm.length > 0) {
    const escaped = escapeRegex(searchTerm);
    const searchRegex = { $regex: escaped, $options: 'i' };

    // Concurrently find matching users and items
    const [matchingUsers, matchingItems] = await Promise.all([
      User.find({
        _id: { $ne: new Types.ObjectId(userId) },
        name: searchRegex,
      })
        .select('_id')
        .lean(),
      Item.find({
        title: searchRegex,
      })
        .select('_id')
        .lean(),
    ]);

    const matchingUserIds = matchingUsers.map(u => u._id);
    const matchingItemIds = matchingItems.map(i => i._id);

    filterQuery.$or = [
      ...(matchingUserIds.length > 0
        ? [{ participants: { $in: matchingUserIds } }]
        : []),
      ...(matchingItemIds.length > 0
        ? [{ itemId: { $in: matchingItemIds } }]
        : []),
      { lastMessage: searchRegex },
    ];
  }

  const chats = await Chat.find(filterQuery)
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'name profilePicture')
    .populate('itemId', 'title photos price status')
    .populate('jobId', JOB_POPULATE_FIELDS)
    .populate('supportId', 'subject');

  if (!chats.length) return [];

  const chatIds = chats.map(c => c._id);

  // Group unread messages count per chat for this user in 1 fast aggregation
  const unreadAgg = await Message.aggregate([
    {
      $match: {
        chatId: { $in: chatIds },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
    },
    {
      $group: {
        _id: '$chatId',
        count: { $sum: 1 },
      },
    },
  ]);

  const unreadMap = new Map<string, number>();
  for (const item of unreadAgg) {
    unreadMap.set(item._id.toString(), item.count);
  }

  return chats.map(chatDoc => {
    const chatObj = chatDoc.toJSON();
    const unreadCount = unreadMap.get(chatDoc._id.toString()) || 0;
    return {
      ...chatObj,
      unreadCount,
      isRead: unreadCount === 0,
    };
  }) as IChatWithUnread[];
};

const getChatById = async (
  chatId: string,
  userId: string,
): Promise<IChatWithUnread> => {
  const [chat, unreadCount] = await Promise.all([
    Chat.findOne({
      _id: new Types.ObjectId(chatId),
      participants: new Types.ObjectId(userId),
    })
      .populate('participants', 'name profilePicture email')
      .populate('itemId', 'title photos price condition status location')
      .populate('jobId', JOB_POPULATE_FIELDS)
      .populate('supportId', 'subject'),
    Message.countDocuments({
      chatId: new Types.ObjectId(chatId),
      readBy: { $ne: new Types.ObjectId(userId) },
    }),
  ]);

  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  const chatObj = chat.toJSON();
  return {
    ...chatObj,
    unreadCount,
    isRead: unreadCount === 0,
  } as IChatWithUnread;
};

const deleteChatFromDB = async (chatId: string, userId: string) => {
  const chat = await Chat.findOne({
    _id: new Types.ObjectId(chatId),
    participants: new Types.ObjectId(userId),
  });

  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Delete all messages associated with this chat
    await Message.deleteMany(
      { chatId: new Types.ObjectId(chatId) },
      { session },
    );

    // Delete the chat itself
    await Chat.findByIdAndDelete(chatId, { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  return { deleted: true, id: chatId };
};

export const ChatService = {
  getOrCreateChat,
  getMyChats,
  getChatById,
  deleteChatFromDB,
};

