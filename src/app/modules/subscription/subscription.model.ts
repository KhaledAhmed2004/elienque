import { Schema, model, Types } from 'mongoose';
import {
  ISubscription,
  SubscriptionModel,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLATFORM,
} from './subscription.interface';

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN),
      default: SUBSCRIPTION_PLAN.FREE,
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.ACTIVE,
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    platform: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLATFORM),
      default: SUBSCRIPTION_PLATFORM.STRIPE,
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
  },
  { timestamps: true }
);

subscriptionSchema.statics.findByUser = async function (userId: Types.ObjectId) {
  return this.findOne({ userId });
};

subscriptionSchema.statics.findByOriginalTxnId = async function (
  originalTxnId: string
) {
  return this.findOne({ originalTransactionId: originalTxnId });
};

subscriptionSchema.statics.findByPurchaseToken = async function (
  purchaseToken: string
) {
  return this.findOne({ purchaseToken });
};

subscriptionSchema.statics.upsertForUser = async function (
  userId: Types.ObjectId,
  payload: Partial<ISubscription>
) {
  return this.findOneAndUpdate(
    { userId },
    { $set: { ...payload, userId } },
    { new: true, upsert: true }
  );
};

export const Subscription = model<ISubscription, SubscriptionModel>(
  'Subscription',
  subscriptionSchema
);