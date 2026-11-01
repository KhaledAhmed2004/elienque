"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const prisma_1 = require("../../../shared/prisma");
const builder_1 = require("../../builder");
exports.SupportService = {
    createSupport: async (userId, payload) => {
        const result = await prisma_1.prisma.supportTicket.create({
            data: {
                subject: payload.subject,
                userId,
                messages: {
                    create: {
                        senderId: userId,
                        message: payload.message,
                    },
                },
            },
            include: {
                messages: true,
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        if (!result) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create support ticket');
        }
        return result;
    },
    getAllSupports: async (query) => {
        const qb = new builder_1.PrismaQueryBuilder(prisma_1.prisma.supportTicket, query, 'SupportTicket')
            .search(['subject', 'user.name', 'user.email'])
            .filter()
            .dateFilter('createdAt')
            .sort('-createdAt', ['createdAt', 'subject'])
            .paginate()
            .include({
            user: { select: { id: true, name: true, email: true } },
            messages: true,
        });
        return qb.execute();
    },
    getMyTickets: async (userId, query) => {
        const qb = new builder_1.PrismaQueryBuilder(prisma_1.prisma.supportTicket, query, 'SupportTicket')
            .search(['subject'])
            .where({ userId })
            .filter({ customExcludes: ['userId'] })
            .dateFilter('createdAt')
            .sort('-createdAt', ['createdAt', 'subject'])
            .paginate()
            .include({
            messages: true,
        });
        return qb.execute();
    },
    getSupportById: async (id) => {
        const result = await prisma_1.prisma.supportTicket.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                messages: true,
            },
        });
        if (!result) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
        return result;
    },
    addMessage: async (ticketId, userId, message) => {
        const ticket = await prisma_1.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
        await prisma_1.prisma.supportMessage.create({
            data: {
                ticketId,
                senderId: userId,
                message,
            },
        });
        return prisma_1.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                messages: true,
            },
        });
    },
    deleteSupport: async (id) => {
        try {
            await prisma_1.prisma.supportTicket.delete({
                where: { id },
            });
            return { deleted: true };
        }
        catch {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
    },
};
//# sourceMappingURL=support.service.js.map