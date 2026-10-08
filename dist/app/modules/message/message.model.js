"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
const messageSchema = new mongoose_1.Schema({
    chatId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
    },
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    text: {
        type: String,
        required: false,
        trim: true,
    },
    attachments: {
        type: [String],
        default: [],
    },
    replyTo: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    readBy: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
        default: [],
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret.chatId;
            delete ret.readBy;
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
messageSchema.index({ chatId: 1, _id: -1 });
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, readBy: 1 });
exports.Message = (0, mongoose_1.model)('Message', messageSchema);
//# sourceMappingURL=message.model.js.map