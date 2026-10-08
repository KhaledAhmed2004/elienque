"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importStar(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const chat_model_1 = require("./chat.model");
const message_model_1 = require("../message/message.model");
const user_model_1 = require("../user/user.model");
const item_model_1 = require("../item/item.model");
const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
const JOB_POPULATE_FIELDS = 'jobType pickup dropoff date time paymentAmount status';
const getOrCreateChat = async (requesterId, participantId, options = {}) => {
    if (requesterId === participantId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot start a chat with yourself');
    }
    const sortedParticipants = [requesterId, participantId].sort();
    const conversationKey = sortedParticipants.join('_');
    // Search for any existing chat matching conversationKey or participants
    const queryConditions = [
        { conversationKey },
        {
            participants: {
                $all: [
                    new mongoose_1.Types.ObjectId(requesterId),
                    new mongoose_1.Types.ObjectId(participantId),
                ],
            },
        },
    ];
    let chat = await chat_model_1.Chat.findOne({ $or: queryConditions });
    if (chat) {
        let needsSave = false;
        // Backfill conversationKey if missing on legacy documents
        if (!chat.conversationKey) {
            chat.conversationKey = conversationKey;
            needsSave = true;
        }
        if (options.jobId &&
            mongoose_1.Types.ObjectId.isValid(options.jobId) &&
            chat.jobId?.toString() !== options.jobId) {
            chat.jobId = new mongoose_1.Types.ObjectId(options.jobId);
            needsSave = true;
        }
        if (options.itemId &&
            mongoose_1.Types.ObjectId.isValid(options.itemId) &&
            chat.itemId?.toString() !== options.itemId) {
            chat.itemId = new mongoose_1.Types.ObjectId(options.itemId);
            needsSave = true;
        }
        if (options.supportId &&
            mongoose_1.Types.ObjectId.isValid(options.supportId) &&
            chat.supportId?.toString() !== options.supportId) {
            chat.supportId = new mongoose_1.Types.ObjectId(options.supportId);
            needsSave = true;
        }
        if (needsSave) {
            try {
                await chat.save();
            }
            catch (e) {
                // If unique constraint conflicts on save, ignore and continue returning the chat
            }
        }
        return chat_model_1.Chat.findById(chat._id)
            .populate('participants', 'name profilePicture')
            .populate('itemId', 'title photos price status')
            .populate('jobId', JOB_POPULATE_FIELDS)
            .populate('supportId', 'subject');
    }
    try {
        chat = await chat_model_1.Chat.create({
            conversationKey,
            participants: sortedParticipants.map(id => new mongoose_1.Types.ObjectId(id)),
            ...(options.itemId &&
                mongoose_1.Types.ObjectId.isValid(options.itemId) && {
                itemId: new mongoose_1.Types.ObjectId(options.itemId),
            }),
            ...(options.jobId &&
                mongoose_1.Types.ObjectId.isValid(options.jobId) && {
                jobId: new mongoose_1.Types.ObjectId(options.jobId),
            }),
            ...(options.supportId &&
                mongoose_1.Types.ObjectId.isValid(options.supportId) && {
                supportId: new mongoose_1.Types.ObjectId(options.supportId),
            }),
            createdBy: new mongoose_1.Types.ObjectId(requesterId),
        });
    }
    catch (err) {
        if (err.code === 11000) {
            // If a collision happens, safely find and return the existing chat
            chat = await chat_model_1.Chat.findOne({
                $or: [
                    { conversationKey },
                    {
                        participants: {
                            $all: [
                                new mongoose_1.Types.ObjectId(requesterId),
                                new mongoose_1.Types.ObjectId(participantId),
                            ],
                        },
                    },
                ],
            });
            if (!chat)
                throw err;
        }
        else {
            throw err;
        }
    }
    return chat_model_1.Chat.findById(chat._id)
        .populate('participants', 'name profilePicture')
        .populate('itemId', 'title photos price status')
        .populate('jobId', JOB_POPULATE_FIELDS)
        .populate('supportId', 'subject');
};
const getMyChats = async (userId, query) => {
    const filterQuery = {
        participants: new mongoose_1.Types.ObjectId(userId),
    };
    const rawSearch = query?.searchTerm;
    const searchTerm = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;
    if (searchTerm && searchTerm.length > 0) {
        const escaped = escapeRegex(searchTerm);
        const searchRegex = { $regex: escaped, $options: 'i' };
        // Concurrently find matching users and items
        const [matchingUsers, matchingItems] = await Promise.all([
            user_model_1.User.find({
                _id: { $ne: new mongoose_1.Types.ObjectId(userId) },
                name: searchRegex,
            })
                .select('_id')
                .lean(),
            item_model_1.Item.find({
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
    const chats = await chat_model_1.Chat.find(filterQuery)
        .sort({ lastMessageAt: -1 })
        .populate('participants', 'name profilePicture')
        .populate('itemId', 'title photos price status')
        .populate('jobId', JOB_POPULATE_FIELDS)
        .populate('supportId', 'subject');
    if (!chats.length)
        return [];
    const chatIds = chats.map(c => c._id);
    // Group unread messages count per chat for this user in 1 fast aggregation
    const unreadAgg = await message_model_1.Message.aggregate([
        {
            $match: {
                chatId: { $in: chatIds },
                readBy: { $ne: new mongoose_1.Types.ObjectId(userId) },
            },
        },
        {
            $group: {
                _id: '$chatId',
                count: { $sum: 1 },
            },
        },
    ]);
    const unreadMap = new Map();
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
    });
};
const getChatById = async (chatId, userId) => {
    const [chat, unreadCount] = await Promise.all([
        chat_model_1.Chat.findOne({
            _id: new mongoose_1.Types.ObjectId(chatId),
            participants: new mongoose_1.Types.ObjectId(userId),
        })
            .populate('participants', 'name profilePicture email')
            .populate('itemId', 'title photos price condition status location')
            .populate('jobId', JOB_POPULATE_FIELDS)
            .populate('supportId', 'subject'),
        message_model_1.Message.countDocuments({
            chatId: new mongoose_1.Types.ObjectId(chatId),
            readBy: { $ne: new mongoose_1.Types.ObjectId(userId) },
        }),
    ]);
    if (!chat) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    const chatObj = chat.toJSON();
    return {
        ...chatObj,
        unreadCount,
        isRead: unreadCount === 0,
    };
};
const deleteChatFromDB = async (chatId, userId) => {
    const chat = await chat_model_1.Chat.findOne({
        _id: new mongoose_1.Types.ObjectId(chatId),
        participants: new mongoose_1.Types.ObjectId(userId),
    });
    if (!chat) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        // Delete all messages associated with this chat
        await message_model_1.Message.deleteMany({ chatId: new mongoose_1.Types.ObjectId(chatId) }, { session });
        // Delete the chat itself
        await chat_model_1.Chat.findByIdAndDelete(chatId, { session });
        await session.commitTransaction();
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        await session.endSession();
    }
    return { deleted: true, id: chatId };
};
exports.ChatService = {
    getOrCreateChat,
    getMyChats,
    getChatById,
    deleteChatFromDB,
};
//# sourceMappingURL=chat.service.js.map