"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const prisma_1 = require("../../../shared/prisma");
const getOrCreateChat = async (requesterId, participantId, _context) => {
    if (requesterId === participantId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot start a chat with yourself');
    }
    const sortedParticipants = [requesterId, participantId].sort();
    const conversationKey = sortedParticipants.join('_');
    let chat = await prisma_1.prisma.chat.findUnique({
        where: { conversationKey },
        include: {
            participants: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
        },
    });
    if (!chat) {
        chat = await prisma_1.prisma.chat.create({
            data: {
                conversationKey,
                participants: {
                    create: [{ userId: requesterId }, { userId: participantId }],
                },
            },
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
    }
    return chat;
};
const getMyChats = async (userId, query) => {
    const rawSearch = query?.searchTerm;
    const searchTerm = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;
    const chats = await prisma_1.prisma.chat.findMany({
        where: {
            participants: {
                some: { userId },
            },
            ...(searchTerm
                ? {
                    OR: [
                        {
                            lastMessage: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                        {
                            participants: {
                                some: {
                                    user: {
                                        name: {
                                            contains: searchTerm,
                                            mode: 'insensitive',
                                        },
                                    },
                                },
                            },
                        },
                    ],
                }
                : {}),
        },
        include: {
            participants: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });
    return chats.map(chat => {
        return {
            ...chat,
            unreadCount: 0,
            isRead: true,
        };
    });
};
const getChatById = async (chatId, userId) => {
    const chat = await prisma_1.prisma.chat.findFirst({
        where: {
            id: chatId,
            participants: {
                some: { userId },
            },
        },
        include: {
            participants: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
        },
    });
    if (!chat) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    return {
        ...chat,
        unreadCount: 0,
        isRead: true,
    };
};
const deleteChatFromDB = async (chatId, userId) => {
    const isParticipant = await prisma_1.prisma.chatParticipant.findFirst({
        where: {
            chatId,
            userId,
        },
    });
    if (!isParticipant) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    }
    await prisma_1.prisma.chat.delete({
        where: { id: chatId },
    });
    return { deleted: true, id: chatId };
};
exports.ChatService = {
    getOrCreateChat,
    getMyChats,
    getChatById,
    deleteChatFromDB,
};
//# sourceMappingURL=chat.service.js.map