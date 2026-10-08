"use strict";
/**
 * Unified Notification Helper Subsystem
 *
 * Central export for multi-channel notifications (Push, Socket, Email, Database),
 * scheduler service, templates, and the NotificationService / NotificationBuilder APIs.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.notificationTemplates = exports.ScheduledNotification = exports.NotificationScheduler = exports.default = exports.NotificationBuilder = exports.NotificationService = void 0;
__exportStar(require("./notification.types"), exports);
__exportStar(require("./notification.service"), exports);
var notification_service_1 = require("./notification.service");
Object.defineProperty(exports, "NotificationService", { enumerable: true, get: function () { return notification_service_1.NotificationService; } });
Object.defineProperty(exports, "NotificationBuilder", { enumerable: true, get: function () { return notification_service_1.NotificationBuilder; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(notification_service_1).default; } });
var scheduler_1 = require("./scheduler");
Object.defineProperty(exports, "NotificationScheduler", { enumerable: true, get: function () { return scheduler_1.NotificationScheduler; } });
Object.defineProperty(exports, "ScheduledNotification", { enumerable: true, get: function () { return scheduler_1.ScheduledNotification; } });
exports.notificationTemplates = __importStar(require("./templates"));
//# sourceMappingURL=index.js.map