"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailOutbox = void 0;
const mongoose_1 = require("mongoose");
const emailOutboxSchema = new mongoose_1.Schema({
    to: { type: String, required: true },
    type: { type: String, required: true },
    template: { type: String },
    encryptedPayload: { type: String, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'FAILED_PERMANENT'],
        default: 'PENDING',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastAttemptAt: { type: Date },
    nextAttemptAt: { type: Date, default: Date.now },
    sentAt: { type: Date },
    lastError: { type: String },
    lockedAt: { type: Date },
}, {
    timestamps: true,
});
// Indexes for efficient querying by the worker
emailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
exports.EmailOutbox = (0, mongoose_1.model)('EmailOutbox', emailOutboxSchema);
//# sourceMappingURL=emailOutbox.model.js.map