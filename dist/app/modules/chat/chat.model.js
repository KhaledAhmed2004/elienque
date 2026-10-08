"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const mongoose_1 = require("mongoose");
const chatSchema = new mongoose_1.Schema({
    conversationKey: {
        type: String,
        unique: true,
        sparse: true,
    },
    participants: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
        required: true,
        validate: {
            validator: (v) => Array.isArray(v) &&
                v.length === 2 &&
                v[0]?.toString() !== v[1]?.toString(),
            message: 'Chat must have exactly 2 distinct participants',
        },
    },
    itemId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Item',
        default: null,
    },
    jobId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
        default: null,
    },
    supportId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Support',
        default: null,
    },
    lastMessage: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret.createdBy;
            delete ret.conversationKey;
            if (!ret.itemId) {
                delete ret.itemId;
            }
            else if (typeof ret.itemId === 'object') {
                delete ret.itemId.__v;
                ret.itemId.id = ret.itemId._id || ret.itemId.id;
                delete ret.itemId._id;
            }
            if (!ret.jobId) {
                delete ret.jobId;
            }
            else if (typeof ret.jobId === 'object') {
                delete ret.jobId.__v;
                delete ret.jobId.hasReview;
                delete ret.jobId.isReviewedByCreator;
                delete ret.jobId.isReviewedByDriver;
                ret.jobId.id = ret.jobId._id || ret.jobId.id;
                delete ret.jobId._id;
            }
            if (!ret.supportId) {
                delete ret.supportId;
            }
            else if (typeof ret.supportId === 'object') {
                delete ret.supportId.__v;
                ret.supportId.id = ret.supportId._id || ret.supportId.id;
                delete ret.supportId._id;
            }
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
// Compound index for user chat listing + sorting
chatSchema.index({ participants: 1, lastMessageAt: -1 });
chatSchema.index({ lastMessageAt: -1 });
exports.Chat = (0, mongoose_1.model)('Chat', chatSchema);
//# sourceMappingURL=chat.model.js.map