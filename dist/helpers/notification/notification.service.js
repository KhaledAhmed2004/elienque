"use strict";
/**
 * NotificationService & NotificationBuilder
 *
 * Central multi-channel notification engine supporting:
 * - Push Notifications (Firebase FCM)
 * - Real-time Socket.IO Events
 * - Transactional & Notification Emails (EmailService)
 * - Database Persistence (MongoDB)
 * - Background Scheduled Notifications
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.NotificationBuilder = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../../app/modules/user/user.model");
const templates = __importStar(require("./templates"));
const push_channel_1 = require("./channels/push.channel");
const socket_channel_1 = require("./channels/socket.channel");
const email_channel_1 = require("./channels/email.channel");
const database_channel_1 = require("./channels/database.channel");
const ScheduledNotification_model_1 = __importDefault(require("./scheduler/ScheduledNotification.model"));
// ==================== TEMPLATE REGISTRY ====================
const templateRegistry = new Map();
// Initialize built-in templates
Object.entries(templates).forEach(([, template]) => {
    if (typeof template === 'object' && 'name' in template) {
        templateRegistry.set(template.name, template);
    }
});
// ==================== NOTIFICATION BUILDER CLASS ====================
class NotificationBuilder {
    userIds = [];
    excludeIds = [];
    targetRole;
    template;
    variables = {};
    content = {};
    channels = new Set();
    scheduledFor;
    options;
    constructor(options) {
        this.options = {
            defaultChannels: [],
            throwOnError: false,
            ...options,
        };
        this.options.defaultChannels?.forEach(channel => {
            this.channels.add(channel);
        });
    }
    // ===== RECIPIENTS =====
    to(recipient) {
        if (typeof recipient === 'string') {
            this.userIds = [recipient];
        }
        else if (recipient instanceof mongoose_1.Types.ObjectId) {
            this.userIds = [recipient.toString()];
        }
        else {
            this.userIds = [recipient._id.toString()];
        }
        return this;
    }
    toMany(recipients) {
        this.userIds = recipients.map(r => typeof r === 'string' ? r : r.toString());
        return this;
    }
    toRole(role) {
        this.targetRole = role;
        return this;
    }
    except(userIds) {
        this.excludeIds = userIds.map(id => typeof id === 'string' ? id : id.toString());
        return this;
    }
    // ===== CONTENT =====
    useTemplate(templateName, variables) {
        const template = templateRegistry.get(templateName);
        if (!template) {
            throw new Error(`Template "${templateName}" not found. Available: ${Array.from(templateRegistry.keys()).join(', ')}`);
        }
        this.template = template;
        if (variables) {
            this.variables = { ...this.variables, ...variables };
        }
        return this;
    }
    setTitle(title) {
        this.content.title = title;
        return this;
    }
    setText(text) {
        this.content.text = text;
        return this;
    }
    setType(type) {
        this.content.type = type;
        return this;
    }
    setReference(referenceId) {
        this.content.referenceId = referenceId;
        return this;
    }
    setData(data) {
        this.content.data = { ...this.content.data, ...data };
        return this;
    }
    setIcon(iconUrl) {
        this.content.icon = iconUrl;
        return this;
    }
    setImage(imageUrl) {
        this.content.image = imageUrl;
        return this;
    }
    // ===== CHANNELS =====
    viaPush() {
        this.channels.add('push');
        return this;
    }
    viaSocket() {
        this.channels.add('socket');
        return this;
    }
    viaEmail() {
        this.channels.add('email');
        return this;
    }
    viaDatabase() {
        this.channels.add('database');
        return this;
    }
    viaAll() {
        this.channels.add('push');
        this.channels.add('socket');
        this.channels.add('email');
        this.channels.add('database');
        return this;
    }
    viaRealtime() {
        this.channels.add('push');
        this.channels.add('socket');
        return this;
    }
    viaPushIf(condition) {
        if (condition)
            this.channels.add('push');
        return this;
    }
    viaEmailIf(condition) {
        if (condition)
            this.channels.add('email');
        return this;
    }
    viaSocketIf(condition) {
        if (condition)
            this.channels.add('socket');
        return this;
    }
    viaDatabaseIf(condition) {
        if (condition)
            this.channels.add('database');
        return this;
    }
    // ===== SCHEDULING =====
    schedule(date) {
        this.scheduledFor = date;
        return this;
    }
    scheduleAfter(duration) {
        const match = duration.match(/^(\d+)(m|h|d|w)$/);
        if (!match) {
            throw new Error('Invalid duration format. Use: 5m (minutes), 2h (hours), 1d (days), 1w (weeks)');
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const now = new Date();
        switch (unit) {
            case 'm':
                now.setMinutes(now.getMinutes() + value);
                break;
            case 'h':
                now.setHours(now.getHours() + value);
                break;
            case 'd':
                now.setDate(now.getDate() + value);
                break;
            case 'w':
                now.setDate(now.getDate() + value * 7);
                break;
        }
        this.scheduledFor = now;
        return this;
    }
    // ===== EXECUTION =====
    async sendNow() {
        const users = await this.resolveUsers();
        if (users.length === 0) {
            return {
                success: true,
                sent: { push: 0, socket: 0, email: 0, database: 0 },
                failed: { push: [], socket: [], email: [], database: [] },
            };
        }
        const resolvedContent = this.resolveContent();
        const result = {
            success: true,
            sent: { push: 0, socket: 0, email: 0, database: 0 },
            failed: { push: [], socket: [], email: [], database: [] },
        };
        if (this.channels.has('push')) {
            try {
                const pushResult = await (0, push_channel_1.sendPush)(users, {
                    title: resolvedContent.push.title,
                    body: resolvedContent.push.body,
                    icon: resolvedContent.push.icon,
                    image: resolvedContent.push.image,
                    data: resolvedContent.push.data,
                });
                result.sent.push = pushResult.sent;
                result.failed.push = pushResult.failed;
            }
            catch (error) {
                console.error('Push channel error:', error);
                result.failed.push = users.map((u) => u._id.toString());
            }
        }
        if (this.channels.has('socket')) {
            try {
                const socketResult = await (0, socket_channel_1.sendSocket)(users, {
                    event: resolvedContent.socket.event,
                    data: resolvedContent.socket.data,
                });
                result.sent.socket = socketResult.sent;
                result.failed.socket = socketResult.failed;
            }
            catch (error) {
                console.error('Socket channel error:', error);
                result.failed.socket = users.map((u) => u._id.toString());
            }
        }
        if (this.channels.has('email')) {
            try {
                const emailResult = await (0, email_channel_1.sendEmail)(users, {
                    template: resolvedContent.email.template,
                    subject: resolvedContent.email.subject,
                    theme: resolvedContent.email.theme,
                    variables: this.variables,
                });
                result.sent.email = emailResult.sent;
                result.failed.email = emailResult.failed;
            }
            catch (error) {
                console.error('Email channel error:', error);
                result.failed.email = users.map((u) => u._id.toString());
            }
        }
        if (this.channels.has('database')) {
            try {
                const dbResult = await (0, database_channel_1.saveToDatabase)(users, {
                    title: resolvedContent.database.title,
                    text: resolvedContent.database.text,
                    type: resolvedContent.database.type,
                    referenceId: this.content.referenceId,
                });
                result.sent.database = dbResult.sent;
                result.failed.database = dbResult.failed;
            }
            catch (error) {
                console.error('Database channel error:', error);
                result.failed.database = users.map((u) => u._id.toString());
            }
        }
        const totalFailed = result.failed.push.length +
            result.failed.socket.length +
            result.failed.email.length +
            result.failed.database.length;
        result.success = totalFailed === 0;
        return result;
    }
    async send() {
        if (this.userIds.length === 0 && !this.targetRole) {
            throw new Error('No recipients specified. Use .to(), .toMany(), or .toRole()');
        }
        if (!this.template && !this.content.text) {
            throw new Error('No content specified. Use .useTemplate() or .setText()');
        }
        if (this.channels.size === 0) {
            throw new Error('No channels specified. Use .viaPush(), .viaSocket(), .viaEmail(), .viaDatabase(), or .viaAll()');
        }
        if (this.scheduledFor && this.scheduledFor > new Date()) {
            return this.saveScheduled();
        }
        return this.sendNow();
    }
    async resolveUsers() {
        const query = {};
        if (this.targetRole) {
            query.role = this.targetRole;
        }
        else if (this.userIds.length > 0) {
            query._id = { $in: this.userIds };
        }
        else {
            return [];
        }
        if (this.excludeIds.length > 0) {
            query._id = { ...query._id, $nin: this.excludeIds };
        }
        const users = await user_model_1.User.find(query).select('_id email deviceTokens role name').lean();
        return users;
    }
    resolveContent() {
        const interpolate = (str, vars) => {
            return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                if (vars[key] !== undefined && vars[key] !== null) {
                    return String(vars[key]);
                }
                if (key === 'messagePreview' && (vars['preview'] || vars['message'] || vars['text'])) {
                    return String(vars['preview'] || vars['message'] || vars['text']);
                }
                if (key === 'preview' && (vars['messagePreview'] || vars['message'] || vars['text'])) {
                    return String(vars['messagePreview'] || vars['message'] || vars['text']);
                }
                if (key === 'senderName' && (vars['name'] || vars['userName'])) {
                    return String(vars['name'] || vars['userName']);
                }
                if (key === 'currency') {
                    return '$';
                }
                return '';
            });
        };
        let push = {
            title: this.content.title || 'Notification',
            body: this.content.text || '',
            icon: this.content.icon,
            image: this.content.image,
            data: this.content.data,
        };
        let socket = {
            event: 'NOTIFICATION',
            data: { ...this.content.data, message: this.content.text },
        };
        let email = {
            template: 'notification',
            subject: this.content.title || 'Notification',
            theme: 'default',
        };
        let database = {
            title: this.content.title,
            text: this.content.text || '',
            type: this.content.type || 'SYSTEM',
        };
        if (this.template) {
            if (this.template.push) {
                push = {
                    title: interpolate(this.template.push.title, this.variables),
                    body: interpolate(this.template.push.body, this.variables),
                    icon: this.template.push.icon || push.icon,
                    image: this.template.push.image || push.image,
                    data: this.template.push.data
                        ? Object.fromEntries(Object.entries(this.template.push.data).map(([k, v]) => [
                            k,
                            interpolate(v, this.variables),
                        ]))
                        : push.data,
                };
            }
            if (this.template.socket) {
                socket = {
                    event: this.template.socket.event,
                    data: this.template.socket.data
                        ? JSON.parse(interpolate(JSON.stringify(this.template.socket.data), this.variables))
                        : socket.data,
                };
            }
            if (this.template.email) {
                email = {
                    template: this.template.email.template,
                    subject: interpolate(this.template.email.subject, this.variables),
                    theme: this.template.email.theme || 'default',
                };
            }
            if (this.template.database) {
                database = {
                    title: this.template.database.title
                        ? interpolate(this.template.database.title, this.variables)
                        : undefined,
                    text: interpolate(this.template.database.text, this.variables),
                    type: this.template.database.type,
                };
            }
        }
        return { push, socket, email, database };
    }
    async saveScheduled() {
        let recipientIds = [];
        if (this.targetRole) {
            const users = await user_model_1.User.find({ role: this.targetRole }).select('_id').lean();
            recipientIds = users.map((u) => u._id.toString());
        }
        else {
            recipientIds = this.userIds;
        }
        if (this.excludeIds.length > 0) {
            recipientIds = recipientIds.filter(id => !this.excludeIds.includes(id));
        }
        const scheduled = await ScheduledNotification_model_1.default.create({
            recipients: recipientIds,
            template: this.template?.name,
            variables: this.variables,
            title: this.content.title,
            text: this.content.text,
            type: this.content.type,
            referenceId: this.content.referenceId,
            data: this.content.data,
            channels: Array.from(this.channels),
            scheduledFor: this.scheduledFor,
            status: 'pending',
        });
        return {
            success: true,
            sent: { push: 0, socket: 0, email: 0, database: 0 },
            failed: { push: [], socket: [], email: [], database: [] },
            scheduled: scheduled._id.toString(),
        };
    }
}
exports.NotificationBuilder = NotificationBuilder;
exports.NotificationService = {
    /**
     * Instantiate a new fluent chainable NotificationBuilder
     */
    create: (options) => {
        return new NotificationBuilder(options);
    },
    /**
     * Alias for create()
     */
    builder: (options) => {
        return new NotificationBuilder(options);
    },
    /**
     * Quick one-line notification dispatcher
     */
    send: async (options) => {
        const builder = new NotificationBuilder();
        if (Array.isArray(options.to)) {
            builder.toMany(options.to);
        }
        else {
            builder.to(options.to);
        }
        if (options.template) {
            builder.useTemplate(options.template, options.variables);
        }
        if (options.title)
            builder.setTitle(options.title);
        if (options.text)
            builder.setText(options.text);
        if (options.type)
            builder.setType(options.type);
        if (options.referenceId)
            builder.setReference(options.referenceId);
        if (options.data)
            builder.setData(options.data);
        if (options.channels && options.channels.length > 0) {
            options.channels.forEach(ch => {
                switch (ch) {
                    case 'push':
                        builder.viaPush();
                        break;
                    case 'socket':
                        builder.viaSocket();
                        break;
                    case 'email':
                        builder.viaEmail();
                        break;
                    case 'database':
                        builder.viaDatabase();
                        break;
                }
            });
        }
        else {
            // Default to all channels
            builder.viaAll();
        }
        if (options.scheduleFor) {
            builder.schedule(options.scheduleFor);
        }
        return builder.send();
    },
    /**
     * Quick convenience method to send a templated notification to a single user
     */
    sendToUser: async (userId, template, variables, channels = ['push', 'socket', 'database']) => {
        return exports.NotificationService.send({
            to: userId,
            template,
            variables,
            channels,
        });
    },
    /**
     * Quick convenience method to broadcast to an entire user role
     */
    sendToRole: async (role, template, variables, channels = ['push', 'socket', 'database']) => {
        const builder = new NotificationBuilder().toRole(role).useTemplate(template, variables);
        channels.forEach(ch => {
            switch (ch) {
                case 'push':
                    builder.viaPush();
                    break;
                case 'socket':
                    builder.viaSocket();
                    break;
                case 'email':
                    builder.viaEmail();
                    break;
                case 'database':
                    builder.viaDatabase();
                    break;
            }
        });
        return builder.send();
    },
    // Template registry management
    registerTemplate: (name, template) => {
        templateRegistry.set(name, template);
    },
    getTemplate: (name) => {
        return templateRegistry.get(name);
    },
    listTemplates: () => {
        return Array.from(templateRegistry.keys());
    },
    // Scheduler helpers
    cancelScheduled: async (scheduledId) => {
        const result = await ScheduledNotification_model_1.default.updateOne({ _id: scheduledId, status: 'pending' }, { status: 'cancelled' });
        return result.modifiedCount > 0;
    },
    getPending: async (userId) => {
        const query = { status: 'pending' };
        if (userId)
            query.recipients = userId;
        return ScheduledNotification_model_1.default.find(query).sort({ scheduledFor: 1 });
    },
};
exports.default = exports.NotificationService;
//# sourceMappingURL=notification.service.js.map