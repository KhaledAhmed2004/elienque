"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const message_service_1 = require("./message.service");
const sendMessage = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const { chatId } = req.params;
    const result = await message_service_1.MessageService.sendMessage(chatId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Message sent successfully',
        data: result,
    });
});
const getMessages = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const { chatId } = req.params;
    const result = await message_service_1.MessageService.getMessages(chatId, userId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Messages retrieved successfully',
        cursor: result.cursor,
        data: result.data,
    });
});
exports.MessageController = { sendMessage, getMessages };
//# sourceMappingURL=message.controller.js.map