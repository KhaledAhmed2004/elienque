import { Model, Types } from 'mongoose';

export enum SUBSCRIPTION_PLAN {
  FREE = 'FREE',
  YEARLY = 'YEARLY',
}

export enum SUBSCRIPTION_STATUS {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INACTIVE = 'inactive',
}

export enum SUBSCRIPTION_PLATFORM {
  STRIPE = 'stripe',
  IOS = 'ios',
  ANDROID = 'android',
}

export type SubscriptionPlanType = SUBSCRIPTION_PLAN;
export type SubscriptionStatusType = SUBSCRIPTION_STATUS;
export type SubscriptionPlatformType = SUBSCRIPTION_PLATFORM;

export type ISubscription = {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  plan: SubscriptionPlanType;
  status: SubscriptionStatusType;
  isPremium?: boolean;
  platform?: SubscriptionPlatformType;
  productId?: string;

  // Apple IAP fields
  originalTransactionId?: string;
  latestTransactionId?: string;
  receiptData?: string;

  // Google Play fields
  purchaseToken?: string;
  orderId?: string;

  // Stripe fields (backward compatible)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  expiresAt?: Date | null;
  currentPeriodEnd?: Date | null;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SubscriptionModel = {
  findByUser(userId: Types.ObjectId): Promise<ISubscription | null>;
  findByOriginalTxnId(originalTxnId: string): Promise<ISubscription | null>;
  findByPurchaseToken(purchaseToken: string): Promise<ISubscription | null>;
  upsertForUser(userId: Types.ObjectId, payload: Partial<ISubscription>): Promise<ISubscription>;
} & Model<ISubscription>;