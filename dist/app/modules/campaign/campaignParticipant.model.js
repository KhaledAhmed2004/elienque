"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignParticipant = void 0;
const mongoose_1 = require("mongoose");
const campaignParticipantSchema = new mongoose_1.Schema({
    campaignId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
    },
    promoterId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    referralCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
// A promoter can only join a specific campaign once
campaignParticipantSchema.index({ campaignId: 1, promoterId: 1 }, { unique: true });
exports.CampaignParticipant = (0, mongoose_1.model)('CampaignParticipant', campaignParticipantSchema);
//# sourceMappingURL=campaignParticipant.model.js.map