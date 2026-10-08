"use strict";
/**
 * ScheduledNotification Model
 *
 * MongoDB model for storing scheduled notifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledNotification = void 0;
const mongoose_1 = require("mongoose");
const ScheduledNotificationSchema = new mongoose_1.Schema({
    recipients: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }],
    template: {
        type: String,
    },
    variables: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    title: {
        type: String,
    },
    text: {
        type: String,
    },
    type: {
        type: String,
        enum: [
            'ADMIN',
            'BID',
            'BID_ACCEPTED',
            'BOOKING',
            'TASK',
            'SYSTEM',
            'DELIVERY_SUBMITTED',
            'PAYMENT_PENDING',
            'ORDER',
            'PAYMENT',
            'MESSAGE',
        ],
        default: 'SYSTEM',
    },
    referenceId: {
        type: mongoose_1.Schema.Types.ObjectId,
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    channels: [{
            type: String,
            enum: ['push', 'socket', 'email', 'database'],
            required: true,
        }],
    scheduledFor: {
        type: Date,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
        default: 'pending',
        index: true,
    },
    result: {
        sent: {
            push: Number,
            socket: Number,
            email: Number,
            database: Number,
        },
        failed: {
            push: [String],
            socket: [String],
            email: [String],
            database: [String],
        },
        processedAt: Date,
        error: String,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});
ScheduledNotificationSchema.index({ scheduledFor: 1, status: 1 }, { name: 'due_notifications_idx' });
ScheduledNotificationSchema.index({ recipients: 1, status: 1 }, { name: 'user_scheduled_idx' });
exports.ScheduledNotification = (0, mongoose_1.model)('ScheduledNotification', ScheduledNotificationSchema);
exports.default = exports.ScheduledNotification;
//# sourceMappingURL=ScheduledNotification.model.js.map