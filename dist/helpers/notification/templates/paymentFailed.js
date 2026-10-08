"use strict";
/**
 * Payment Failed Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentFailed = void 0;
exports.paymentFailed = {
    name: 'paymentFailed',
    push: {
        title: 'Payment Failed',
        body: 'Your payment of {{currency}}{{amount}} could not be processed. {{reason}}',
        data: {
            type: 'PAYMENT_FAILED',
            amount: '{{amount}}',
            currency: '{{currency}}',
            action: 'RETRY_PAYMENT',
        },
    },
    socket: {
        event: 'PAYMENT_FAILED',
        data: {
            type: 'PAYMENT_FAILED',
            amount: '{{amount}}',
            currency: '{{currency}}',
            reason: '{{reason}}',
        },
    },
    database: {
        type: 'PAYMENT',
        title: 'Payment Failed',
        text: 'Your payment of {{currency}}{{amount}} could not be processed. {{reason}}',
    },
};
exports.default = exports.paymentFailed;
//# sourceMappingURL=paymentFailed.js.map