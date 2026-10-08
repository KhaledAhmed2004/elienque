"use strict";
/**
 * Payment Received Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentReceived = void 0;
exports.paymentReceived = {
    name: 'paymentReceived',
    push: {
        title: 'Payment Received',
        body: 'You received a payment of {{currency}}{{amount}} for {{description}}',
        data: {
            type: 'PAYMENT_RECEIVED',
            amount: '{{amount}}',
            currency: '{{currency}}',
            paymentId: '{{paymentId}}',
            action: 'VIEW_EARNINGS',
        },
    },
    socket: {
        event: 'PAYMENT_RECEIVED',
        data: {
            type: 'PAYMENT_RECEIVED',
            amount: '{{amount}}',
            currency: '{{currency}}',
            paymentId: '{{paymentId}}',
            description: '{{description}}',
        },
    },
    database: {
        type: 'PAYMENT',
        title: 'Payment Received',
        text: 'You received a payment of {{currency}}{{amount}} for {{description}}',
    },
};
exports.default = exports.paymentReceived;
//# sourceMappingURL=paymentReceived.js.map