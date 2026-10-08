"use strict";
/**
 * Email Channel - EmailService Integration
 *
 * Sends email notifications using the centralized EmailService.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const email_1 = require("../../email");
/**
 * Send email notifications via EmailService
 */
const sendEmail = async (users, content) => {
    const result = { sent: 0, failed: [] };
    for (const user of users) {
        if (!user.email) {
            continue;
        }
        try {
            const variables = {
                ...content.variables,
                name: user.name || 'User',
                email: user.email,
                userId: user._id.toString(),
            };
            await email_1.EmailService.sendNotification({
                email: user.email,
                name: user.name,
                title: content.subject || 'Moeb26 Notification',
                message: variables.message || variables.text || 'You have a new notification.',
                actionText: variables.actionText,
                actionUrl: variables.actionUrl,
            });
            result.sent++;
        }
        catch (error) {
            console.error(`Email send error for user ${user._id}:`, error);
            result.failed.push(user._id.toString());
        }
    }
    return result;
};
exports.sendEmail = sendEmail;
exports.default = exports.sendEmail;
//# sourceMappingURL=email.channel.js.map