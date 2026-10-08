"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const CursorQueryBuilder_1 = __importDefault(require("../../builder/CursorQueryBuilder"));
const message_model_1 = require("./message.model");
const chat_model_1 = require("../chat/chat.model");
const notification_1 = require("../../../helpers/notification");
const user_model_1 = require("../user/user.model");
const sendMessage = async (chatId, senderId, payload) => {
    const chat = await chat_model_1.Chat.findOne({
        _id: chatId,
        participants: senderId,
    }).lean();
    if (!chat) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    // If replying to a specific message, ensure the target message exists within the same chat
    if (payload.replyTo) {
        const referencedMessage = await message_model_1.Message.findOne({
            _id: payload.replyTo,
            chatId: new mongoose_1.Types.ObjectId(chatId),
        }).lean();
        if (!referencedMessage) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Referenced message not found in this chat');
        }
    }
    const rawAttachments = payload.attachments ||
        payload.file ||
        payload.image ||
        payload.files;
    const normalizedAttachments = rawAttachments
        ? Array.isArray(rawAttachments)
            ? rawAttachments
            : [rawAttachments]
        : [];
    const message = await message_model_1.Message.create({
        chatId: new mongoose_1.Types.ObjectId(chatId),
        sender: new mongoose_1.Types.ObjectId(senderId),
        text: payload.text,
        attachments: normalizedAttachments,
        replyTo: payload.replyTo ? new mongoose_1.Types.ObjectId(payload.replyTo) : null,
        readBy: [new mongoose_1.Types.ObjectId(senderId)],
    });
    let preview = (payload.text || '').trim().substring(0, 100);
    if (!preview && normalizedAttachments.length > 0) {
        preview = 'Attachment';
    }
    await chat_model_1.Chat.findByIdAndUpdate(chatId, {
        lastMessage: preview,
        lastMessageAt: message.createdAt,
    });
    const recipientId = chat.participants
        .map(p => p.toString())
        .find(id => id !== senderId);
    if (recipientId) {
        const sender = await user_model_1.User.findById(senderId).select('name profilePicture').lean();
        const previewText = preview.substring(0, 80);
        new notification_1.NotificationBuilder()
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
            .catch(() => { });
        const io = global.io;
        if (io) {
            const populatedMessage = await message_model_1.Message.findById(message._id)
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
const getMessages = async (chatId, userId, query) => {
    const chatExists = await chat_model_1.Chat.exists({ _id: chatId, participants: userId });
    if (!chatExists) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
    }
    const result = await new CursorQueryBuilder_1.default(message_model_1.Message.find({ chatId: new mongoose_1.Types.ObjectId(chatId) }), query, { defaultLimit: 20, maxLimit: 100 })
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
        await message_model_1.Message.updateMany({
            _id: { $in: returnedIds },
            readBy: { $ne: new mongoose_1.Types.ObjectId(userId) },
        }, {
            $addToSet: { readBy: new mongoose_1.Types.ObjectId(userId) },
        });
    }
    return {
        cursor: result.cursor,
        data: [...result.data].reverse(),
    };
};
exports.MessageService = { sendMessage, getMessages };
//# sourceMappingURL=message.service.js.map