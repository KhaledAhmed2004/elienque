"use strict";
/**
 * System Alert Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemAlert = void 0;
exports.systemAlert = {
    name: 'systemAlert',
    push: {
        title: 'System Alert: {{alertTitle}}',
        body: '{{alertMessage}}',
        data: {
            type: 'SYSTEM_ALERT',
            severity: '{{severity}}',
            action: 'VIEW_ALERT',
        },
    },
    socket: {
        event: 'SYSTEM_ALERT',
        data: {
            type: 'SYSTEM_ALERT',
            title: '{{alertTitle}}',
            message: '{{alertMessage}}',
            severity: '{{severity}}',
        },
    },
    database: {
        type: 'SYSTEM',
        title: '{{alertTitle}}',
        text: '{{alertMessage}}',
    },
};
exports.default = exports.systemAlert;
//# sourceMappingURL=systemAlert.js.map