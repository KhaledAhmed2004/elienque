"use strict";
/**
 * Socket Channel - Socket.IO Real-time Notifications
 *
 * Emits real-time events to connected users via Socket.IO.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSocket = void 0;
/**
 * Send real-time notifications via Socket.IO
 */
const sendSocket = async (users, content) => {
    const result = { sent: 0, failed: [] };
    const io = global.io;
    if (!io) {
        if (process.env.NODE_ENV !== 'test') {
            console.warn('Socket.IO not initialized, skipping socket notifications');
        }
        return { sent: 0, failed: users.map(u => u._id.toString()) };
    }
    const timestamp = new Date().toISOString();
    for (const user of users) {
        try {
            const userId = user._id.toString();
            // Emit to user's private room (user::{userId})
            io.to(`user::${userId}`).emit(content.event, {
                ...content.data,
                timestamp,
            });
            // Legacy format compatibility: get-notification::{userId}
            io.emit(`get-notification::${userId}`, {
                ...content.data,
                timestamp,
            });
            result.sent++;
        }
        catch (error) {
            console.error(`Socket emit error for user ${user._id}:`, error);
            result.failed.push(user._id.toString());
        }
    }
    return result;
};
exports.sendSocket = sendSocket;
exports.default = exports.sendSocket;
//# sourceMappingURL=socket.channel.js.map