"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Support = void 0;
const mongoose_1 = require("mongoose");
require("../chat/chat.model");
const supportMessageSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
}, { timestamps: { createdAt: true, updatedAt: false } });
const supportSchema = new mongoose_1.Schema({
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    messages: [supportMessageSchema],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
supportSchema.virtual('chat', {
    ref: 'Chat',
    localField: '_id',
    foreignField: 'supportId',
    justOne: true,
});
exports.Support = (0, mongoose_1.model)('Support', supportSchema);
//# sourceMappingURL=support.model.js.map