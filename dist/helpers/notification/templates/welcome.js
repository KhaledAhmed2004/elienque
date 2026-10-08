"use strict";
/**
 * Welcome Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcome = void 0;
exports.welcome = {
    name: 'welcome',
    push: {
        title: 'Welcome to Moeb26!',
        body: 'Thank you for joining. Get started by completing your profile.',
        data: {
            type: 'WELCOME',
            action: 'VIEW_PROFILE',
        },
    },
    socket: {
        event: 'NOTIFICATION',
        data: {
            type: 'WELCOME',
            message: 'Welcome to Moeb26! We are excited to have you on board.',
        },
    },
    database: {
        type: 'SYSTEM',
        title: 'Welcome to Moeb26!',
        text: 'Thank you for joining Moeb26. Get started by completing your profile.',
    },
};
exports.default = exports.welcome;
//# sourceMappingURL=welcome.js.map