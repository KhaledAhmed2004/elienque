"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotifications = void 0;
const config_1 = __importDefault(require("../../../config"));
const prisma_1 = require("../../../shared/prisma");
const notification_model_1 = require("./notification.model");
const pushNotificationHelper_1 = require("./pushNotificationHelper");
const sendNotifications = async (data) => {
    const notification = await notification_model_1.Notification.create(data);
    // If receiver is a user in postgres
    await prisma_1.prisma.user.findUnique({
        where: { id: data.receiver?.toString() },
        select: { id: true },
    }).catch(() => null);
    await sendPushNotification(undefined, notification);
    emitRealtimeNotification(data.receiver, notification);
    return notification;
};
exports.sendNotifications = sendNotifications;
const sendPushNotification = async (deviceTokens, notification) => {
    if (!deviceTokens?.length)
        return;
    const message = {
        notification: {
            title: notification.title || config_1.default.app.name || 'Notification',
            body: notification.text,
        },
        tokens: deviceTokens,
    };
    try {
        await pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications(message);
    }
    catch (error) {
        console.error('Failed to send push notification:', error);
    }
};
const emitRealtimeNotification = (receiver, notification) => {
    const socketIo = global.io;
    if (!socketIo || !receiver)
        return;
    socketIo.emit(`get-notification::${receiver.toString()}`, notification);
};
//# sourceMappingURL=notificationsHelper.js.map