"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const getNotificationsByCursor = async (userId, limit, cursor) => {
    const query = {
        receiver: new mongoose_1.default.Types.ObjectId(userId),
    };
    if (cursor && mongoose_1.default.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: new mongoose_1.default.Types.ObjectId(cursor) };
    }
    const items = await notification_model_1.NotificationModel.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1]._id?.toString() || null
        : null;
    return {
        type: 'cursor',
        cursor: {
            nextCursor,
            hasMore,
            limit,
        },
        data,
    };
};
const getNotificationsByOffset = async (userId, limit, pageNumber) => {
    const page = Math.max(1, Number(pageNumber) || 1);
    const skip = (page - 1) * limit;
    const [data, total, unreadCount] = await Promise.all([
        notification_model_1.NotificationModel.find({ receiver: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        notification_model_1.NotificationModel.countDocuments({ receiver: userId }),
        notification_model_1.NotificationModel.countDocuments({ receiver: userId, isRead: false }),
    ]);
    return {
        type: 'offset',
        pagination: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit) || 1,
            unreadCount,
        },
        data,
    };
};
const getOwnedNotification = async (notificationId, userId) => {
    const notification = await notification_model_1.NotificationModel.findById(notificationId);
    if (!notification) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Notification not found');
    }
    if (notification.receiver?.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized');
    }
    return notification;
};
const getUserNotifications = async (userId, options) => {
    const limit = Math.max(1, Number(options?.limit) || 20);
    if (options?.cursor !== undefined) {
        return getNotificationsByCursor(userId, limit, options.cursor);
    }
    return getNotificationsByOffset(userId, limit, options?.page);
};
const markAllRead = async (userId) => {
    await notification_model_1.NotificationModel.updateMany({ receiver: userId, isRead: false }, { $set: { isRead: true, read: true } });
    return { updated: true };
};
const markRead = async (notificationId, userId, read = true) => {
    const notification = await getOwnedNotification(notificationId, userId);
    notification.isRead = read;
    notification.read = read;
    await notification.save();
    return notification;
};
const deleteNotification = async (notificationId, userId) => {
    const notification = await getOwnedNotification(notificationId, userId);
    await notification.deleteOne();
    return { deleted: true };
};
exports.NotificationService = {
    getUserNotifications,
    markAllRead,
    markRead,
    deleteNotification,
};
//# sourceMappingURL=notification.service.js.map