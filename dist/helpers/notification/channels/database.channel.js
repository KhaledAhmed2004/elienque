"use strict";
/**
 * Database Channel - MongoDB Notification Storage
 *
 * Persists notifications to the Notification collection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveToDatabase = void 0;
const notification_model_1 = require("../../../app/modules/notification/notification.model");
/**
 * Save notifications to MongoDB
 */
const saveToDatabase = async (users, content) => {
    const result = { sent: 0, failed: [] };
    const notifications = users.map(user => ({
        title: content.title,
        text: content.text,
        receiver: user._id,
        type: content.type || 'SYSTEM',
        referenceId: content.referenceId,
        isRead: false,
    }));
    try {
        const created = await notification_model_1.Notification.insertMany(notifications, {
            ordered: false,
        });
        result.sent = created.length;
    }
    catch (error) {
        if (error.insertedDocs) {
            result.sent = error.insertedDocs.length;
            const insertedIds = new Set(error.insertedDocs.map((d) => d.receiver.toString()));
            result.failed = users
                .filter(u => !insertedIds.has(u._id.toString()))
                .map(u => u._id.toString());
        }
        else {
            console.error('Database insert error:', error);
            result.failed = users.map(u => u._id.toString());
        }
    }
    return result;
};
exports.saveToDatabase = saveToDatabase;
exports.default = exports.saveToDatabase;
//# sourceMappingURL=database.channel.js.map