"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const prisma_1 = require("../../../shared/prisma");
const builder_1 = require("../../builder");
const notification_1 = require("../../../helpers/notification");
const sendMessage = async (chatId, senderId, payload) => {
    const chat = await prisma_1.prisma.chat.findUnique({
        where: { id: chatId },
        include: {
            participants: true,
        },
    });
    if (!chat || !chat.participants.some(p => p.userId === senderId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    // If replying to a specific message, ensure the target message exists within the same chat
    if (payload.replyTo) {
        const referencedMessage = await prisma_1.prisma.message.findFirst({
            where: {
                id: payload.replyTo,
                chatId,
            },
        });
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
    const message = await prisma_1.prisma.message.create({
        data: {
            chatId,
            senderId,
            text: payload.text,
            attachments: normalizedAttachments,
            replyToId: payload.replyTo || null,
            readByIds: [senderId],
        },
        include: {
            sender: { select: { id: true, name: true, email: true } },
            replyTo: {
                include: {
                    sender: { select: { id: true, name: true } },
                },
            },
        },
    });
    let preview = (payload.text || '').trim().substring(0, 100);
    if (!preview && normalizedAttachments.length > 0) {
        preview = 'Attachment';
    }
    await prisma_1.prisma.chat.update({
        where: { id: chatId },
        data: {
            lastMessage: preview,
            lastMessageAt: message.createdAt,
        },
    });
    const recipient = chat.participants.find(p => p.userId !== senderId);
    if (recipient) {
        const previewText = preview.substring(0, 80);
        new notification_1.NotificationBuilder()
            .to(recipient.userId)
            .useTemplate('newMessage', {
            senderId: String(senderId),
            senderName: message.sender?.name || 'Someone',
            senderAvatar: '',
            messagePreview: previewText,
            preview: previewText,
            chatId,
            messageId: message.id,
        })
            .viaPush()
            .viaSocket()
            .viaDatabase()
            .send()
            .catch(() => { });
        const io = global.io;
        if (io) {
            io.to(`user::${recipient.userId}`).emit('NEW_MESSAGE', {
                chatId,
                message,
            });
        }
    }
    return message;
};
const getMessages = async (chatId, userId, query) => {
    const isParticipant = await prisma_1.prisma.chatParticipant.findFirst({
        where: { chatId, userId },
    });
    if (!isParticipant) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
    }
    const qb = new builder_1.PrismaQueryBuilder(prisma_1.prisma.message, query, 'Message')
        .where({ chatId })
        .search(['text'])
        .cursorPaginate('id', 'desc', 20, 100)
        .include({
        sender: { select: { id: true, name: true, email: true } },
        replyTo: {
            include: {
                sender: { select: { id: true, name: true } },
            },
        },
    });
    const result = await qb.executeCursor();
    // Mark unread messages as read
    const unreadIds = result.data
        .filter((m) => !m.readByIds?.includes(userId))
        .map((m) => m.id);
    if (unreadIds.length > 0) {
        await prisma_1.prisma.$executeRawUnsafe(`UPDATE "Message" SET "readByIds" = array_append("readByIds", $1) WHERE "id" = ANY($2::uuid[])`, userId, unreadIds).catch(() => { });
    }
    return {
        cursor: result.cursor,
        data: [...result.data].reverse(),
    };
};
exports.MessageService = { sendMessage, getMessages };
//# sourceMappingURL=message.service.js.map