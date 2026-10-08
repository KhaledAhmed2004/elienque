"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const support_model_1 = require("./support.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
exports.SupportService = {
    createSupport: async (userId, payload) => {
        const result = await support_model_1.Support.create({
            subject: payload.subject,
            user: userId,
            messages: [{ sender: userId, message: payload.message }],
        });
        if (!result) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create support ticket');
        }
        return result;
    },
    getAllSupports: async (query) => {
        const qb = new QueryBuilder_1.default(support_model_1.Support.find(), query)
            .search(['subject'])
            .filter()
            .sort()
            .paginate()
            .fields();
        const data = await qb.modelQuery
            .populate('user', 'name email')
            .populate('chat', '_id');
        const paginationInfo = await qb.getPaginationInfo();
        return { pagination: paginationInfo, data };
    },
    getMyTickets: async (userId, query) => {
        const qb = new QueryBuilder_1.default(support_model_1.Support.find({ user: userId }), query)
            .search(['subject'])
            .filter()
            .sort()
            .paginate()
            .fields();
        const data = await qb.modelQuery.populate('chat', '_id');
        const paginationInfo = await qb.getPaginationInfo();
        return { pagination: paginationInfo, data };
    },
    getSupportById: async (id) => {
        const result = await support_model_1.Support.findById(id)
            .populate('user', 'name email')
            .populate('messages.sender', 'name email')
            .populate('chat', '_id');
        if (!result) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
        return result;
    },
    addMessage: async (ticketId, userId, message) => {
        const ticket = await support_model_1.Support.findById(ticketId);
        if (!ticket) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
        ticket.messages.push({ sender: userId, message });
        await ticket.save();
        const result = await support_model_1.Support.findById(ticketId)
            .populate('user', 'name email')
            .populate('messages.sender', 'name email');
        return result;
    },
    deleteSupport: async (id) => {
        const result = await support_model_1.Support.findByIdAndDelete(id);
        if (!result) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Support ticket not found');
        }
        return { deleted: true };
    },
};
//# sourceMappingURL=support.service.js.map