"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = void 0;
const mongoose_1 = require("mongoose");
const subscription_interface_1 = require("./subscription.interface");
const subscriptionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
        unique: true,
    },
    plan: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_PLAN),
        default: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
    },
    status: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_STATUS),
        default: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
    },
    isPremium: {
        type: Boolean,
        default: false,
        index: true,
    },
    platform: {
        type: String,
        enum: Object.values(subscription_interface_1.SUBSCRIPTION_PLATFORM),
        default: subscription_interface_1.SUBSCRIPTION_PLATFORM.STRIPE,
    },
    productId: {
        type: String,
    },
    // Apple IAP
    originalTransactionId: {
        type: String,
        index: { unique: true, sparse: true },
    },
    latestTransactionId: {
        type: String,
    },
    receiptData: {
        type: String,
    },
    // Google Play
    purchaseToken: {
        type: String,
        index: { unique: true, sparse: true },
    },
    orderId: {
        type: String,
    },
    // Stripe
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    expiresAt: { type: Date, default: null, index: true },
    currentPeriodEnd: { type: Date, default: null },
    metadata: { type: Object },
}, { timestamps: true });
subscriptionSchema.statics.findByUser = async function (userId) {
    return this.findOne({ userId });
};
subscriptionSchema.statics.findByOriginalTxnId = async function (originalTxnId) {
    return this.findOne({ originalTransactionId: originalTxnId });
};
subscriptionSchema.statics.findByPurchaseToken = async function (purchaseToken) {
    return this.findOne({ purchaseToken });
};
subscriptionSchema.statics.upsertForUser = async function (userId, payload) {
    return this.findOneAndUpdate({ userId }, { $set: { ...payload, userId } }, { new: true, upsert: true });
};
exports.Subscription = (0, mongoose_1.model)('Subscription', subscriptionSchema);
//# sourceMappingURL=subscription.model.js.map