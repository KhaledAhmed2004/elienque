"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const notification_service_1 = require("./notification.service");
const listMyNotifications = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const options = {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        cursor: req.query.cursor,
    };
    const result = await notification_service_1.NotificationService.getUserNotifications(userId, options);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Notifications fetched',
        ...(result.type === 'cursor' && { cursor: result.cursor }),
        ...(result.type === 'offset' && { pagination: result.pagination }),
        data: result.data,
    });
});
const markAllRead = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const result = await notification_service_1.NotificationService.markAllRead(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'All notifications marked read',
        data: result,
    });
});
const markRead = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.notificationId;
    const read = req.body?.read ?? true;
    const result = await notification_service_1.NotificationService.markRead(notificationId, userId, read);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: read ? 'Notification marked read' : 'Notification marked unread',
        data: result,
    });
});
const deleteNotification = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.notificationId;
    const result = await notification_service_1.NotificationService.deleteNotification(notificationId, userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Notification deleted',
        data: result,
    });
});
exports.NotificationController = {
    listMyNotifications,
    markAllRead,
    markRead,
    deleteNotification,
};
//# sourceMappingURL=notification.controller.js.map