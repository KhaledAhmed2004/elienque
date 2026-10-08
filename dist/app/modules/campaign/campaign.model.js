"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Campaign = void 0;
const mongoose_1 = require("mongoose");
const campaign_1 = require("../../../enums/campaign");
const campaignSchema = new mongoose_1.Schema({
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    reward: {
        type: String,
        required: true,
        trim: true,
    },
    offer: {
        type: String,
        required: true,
        trim: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(campaign_1.CAMPAIGN_STATUS),
        default: campaign_1.CAMPAIGN_STATUS.DRAFT,
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
exports.Campaign = (0, mongoose_1.model)('Campaign', campaignSchema);
//# sourceMappingURL=campaign.model.js.map