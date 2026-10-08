"use strict";
/**
 * Notification Scheduler Service
 *
 * Background job that processes scheduled notifications.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationScheduler = void 0;
const ScheduledNotification_model_1 = __importDefault(require("./ScheduledNotification.model"));
const notification_service_1 = require("../notification.service");
const logger_1 = require("../../../shared/logger");
let cron = null;
try {
    cron = require('node-cron');
}
catch (e) {
    // node-cron optional
}
class NotificationScheduler {
    static isRunning = false;
    static cronJob = null;
    static intervalId = null;
    static start() {
        if (this.cronJob || this.intervalId) {
            console.warn('Notification scheduler already started');
            return;
        }
        if (cron) {
            this.cronJob = cron.schedule('* * * * *', async () => {
                await this.processScheduled();
            });
        }
        else {
            this.intervalId = setInterval(async () => {
                await this.processScheduled();
            }, 60000);
        }
        logger_1.logger.info('Notification scheduler started');
    }
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger_1.logger.info('Notification scheduler stopped');
    }
    static async processScheduled() {
        if (this.isRunning)
            return 0;
        this.isRunning = true;
        let processedCount = 0;
        try {
            const now = new Date();
            const query = { scheduledFor: { $lte: now }, status: 'pending' };
            const dueNotifications = await ScheduledNotification_model_1.default.find(query)
                .limit(100)
                .sort({ scheduledFor: 1 });
            for (const scheduled of dueNotifications) {
                try {
                    await this.processSingle(scheduled);
                    processedCount++;
                }
                catch (error) {
                    logger_1.logger.error('Failed to process scheduled notification', error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Notification scheduler error:', error);
        }
        finally {
            this.isRunning = false;
        }
        return processedCount;
    }
    static async processSingle(scheduled) {
        scheduled.status = 'processing';
        await scheduled.save();
        try {
            let builder = new notification_service_1.NotificationBuilder();
            builder = builder.toMany(scheduled.recipients.map(id => id.toString()));
            if (scheduled.template) {
                builder = builder.useTemplate(scheduled.template, scheduled.variables || {});
            }
            else {
                if (scheduled.title)
                    builder = builder.setTitle(scheduled.title);
                if (scheduled.text)
                    builder = builder.setText(scheduled.text);
                if (scheduled.type)
                    builder = builder.setType(scheduled.type);
                if (scheduled.referenceId)
                    builder = builder.setReference(scheduled.referenceId);
                if (scheduled.data)
                    builder = builder.setData(scheduled.data);
            }
            for (const channel of scheduled.channels) {
                switch (channel) {
                    case 'push':
                        builder = builder.viaPush();
                        break;
                    case 'socket':
                        builder = builder.viaSocket();
                        break;
                    case 'email':
                        builder = builder.viaEmail();
                        break;
                    case 'database':
                        builder = builder.viaDatabase();
                        break;
                }
            }
            const result = await builder.sendNow();
            scheduled.status = 'sent';
            scheduled.result = { sent: result.sent, failed: result.failed, processedAt: new Date() };
            await scheduled.save();
        }
        catch (error) {
            scheduled.status = 'failed';
            scheduled.result = { error: error.message, processedAt: new Date() };
            await scheduled.save();
            throw error;
        }
    }
    static async cancel(scheduledId) {
        const result = await ScheduledNotification_model_1.default.updateOne({ _id: scheduledId, status: 'pending' }, { status: 'cancelled' });
        return result.modifiedCount > 0;
    }
    static async getPending(userId) {
        const query = { status: 'pending' };
        if (userId)
            query.recipients = userId;
        return ScheduledNotification_model_1.default.find(query).sort({ scheduledFor: 1 }).lean();
    }
    static async getById(scheduledId) {
        return ScheduledNotification_model_1.default.findById(scheduledId).lean();
    }
    static async cleanup(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await ScheduledNotification_model_1.default.deleteMany({
            status: { $in: ['sent', 'failed', 'cancelled'] },
            updatedAt: { $lt: cutoffDate },
        });
        return result.deletedCount;
    }
}
exports.NotificationScheduler = NotificationScheduler;
exports.default = NotificationScheduler;
//# sourceMappingURL=scheduler.service.js.map