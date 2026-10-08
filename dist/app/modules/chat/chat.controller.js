"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const chat_service_1 = require("./chat.service");
const getOrCreate = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const { participantId, itemId, jobId, supportId } = req.body;
    const result = await chat_service_1.ChatService.getOrCreateChat(userId, participantId, {
        itemId,
        jobId,
        supportId,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chat retrieved successfully',
        data: result,
    });
});
const getMyChats = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const result = await chat_service_1.ChatService.getMyChats(userId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chats retrieved successfully',
        data: result,
    });
});
const getChatById = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const { chatId } = req.params;
    const result = await chat_service_1.ChatService.getChatById(chatId, userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chat retrieved successfully',
        data: result,
    });
});
const deleteChat = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const { chatId } = req.params;
    const result = await chat_service_1.ChatService.deleteChatFromDB(chatId, userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chat deleted successfully',
        data: result,
    });
});
exports.ChatController = {
    getOrCreate,
    getMyChats,
    getChatById,
    deleteChat,
};
//# sourceMappingURL=chat.controller.js.map