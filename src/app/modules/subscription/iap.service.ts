import fs from 'fs';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { Subscription as SubscriptionModel } from './subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLATFORM,
} from './subscription.interface';

const APPLE_PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

export interface IAppleVerifyResult {
  isPremium: boolean;
  expiresAt: Date;
  productId: string;
  platform: 'ios';
  transactionId: string;
}

export interface IGoogleVerifyResult {
  isPremium: boolean;
  expiresAt: Date;
  productId: string;
  platform: 'android';
  orderId?: string;
}

export interface ISubscriptionStatusResult {
  isPremium: boolean;
  expiresAt?: Date | null;
  platform?: string;
  productId?: string;
}

/**
 * Verifies an Apple App Store receipt with auto-fallback to Sandbox (for TestFlight)
 */
export const verifyAppleReceipt = async (
  receiptData: string,
  userId: string
): Promise<IAppleVerifyResult> => {
  if (!receiptData || typeof receiptData !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Receipt data is required');
  }

  const payload = {
    'receipt-data': receiptData.trim(),
    password: config.iap.appleSharedSecret,
    'exclude-old-transactions': true,
  };

  let response;
  try {
    response = await axios.post(APPLE_PROD_URL, payload, { timeout: 15000 });
  } catch (error: any) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `Failed to contact Apple verification server: ${error.message}`
    );
  }

  let appleData = response.data;

  // Status 21007: Sandbox receipt was sent to production server. Retry with Sandbox URL.
  if (appleData?.status === 21007) {
    try {
      const sandboxResponse = await axios.post(APPLE_SANDBOX_URL, payload, {
        timeout: 15000,
      });
      appleData = sandboxResponse.data;
    } catch (error: any) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        `Failed to contact Apple Sandbox server: ${error.message}`
      );
    }
  }

  if (appleData?.status !== 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Apple receipt invalid. Status code: ${appleData?.status}`
    );
  }

  // Extract all transactions from latest_receipt_info or fallback to receipt.in_app
  const transactions: any[] =
    appleData.latest_receipt_info || appleData.receipt?.in_app || [];

  if (transactions.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No subscription transaction found in Apple receipt'
    );
  }

  // Sort by expires_date_ms descending to pick the most recent transaction
  const sorted = transactions
    .filter((t: any) => t && t.expires_date_ms)
    .sort(
      (a: any, b: any) =>
        Number(b.expires_date_ms) - Number(a.expires_date_ms)
    );

  if (sorted.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'No expiring subscription found in receipt'
    );
  }

  const latest = sorted[0];
  const expiresAt = new Date(Number(latest.expires_date_ms));
  const isPremium = expiresAt.getTime() > Date.now();
  const originalTxnId = latest.original_transaction_id || latest.transaction_id;
  const userObjectId = new Types.ObjectId(userId);

  // Anti-Hijacking Check (INV-01): Ensure receipt isn't already active on another user's account
  if (originalTxnId) {
    const existingWithSameTxn =
      await SubscriptionModel.findByOriginalTxnId(originalTxnId);
    if (
      existingWithSameTxn &&
      existingWithSameTxn.userId.toString() !== userObjectId.toString() &&
      existingWithSameTxn.isPremium &&
      existingWithSameTxn.expiresAt &&
      existingWithSameTxn.expiresAt.getTime() > Date.now()
    ) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This App Store subscription is already active on another account'
      );
    }
  }

  // Save to database
  await SubscriptionModel.upsertForUser(userObjectId, {
    plan: SUBSCRIPTION_PLAN.YEARLY,
    status: isPremium ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.INACTIVE,
    isPremium,
    platform: SUBSCRIPTION_PLATFORM.IOS,
    productId: latest.product_id || config.iap.productId,
    originalTransactionId: originalTxnId,
    latestTransactionId: latest.transaction_id,
    receiptData,
    expiresAt,
    currentPeriodEnd: expiresAt,
  });

  return {
    isPremium,
    expiresAt,
    productId: latest.product_id || config.iap.productId,
    platform: 'ios',
    transactionId: latest.transaction_id,
  };
};

/**
 * Verifies Google Play Billing subscription with idempotency guards for :acknowledge
 */
export const verifyGooglePurchase = async (
  purchaseToken: string,
  productId: string,
  orderId: string,
  userId: string
): Promise<IGoogleVerifyResult> => {
  if (!purchaseToken || typeof purchaseToken !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Purchase token is required');
  }

  const keyPath = config.iap.googleServiceAccountKeyPath;
  if (!fs.existsSync(keyPath)) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Google service account key file is missing on server'
    );
  }

  let accessToken: string;
  try {
    const authClient = new GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const tokenResult: any = await authClient.getAccessToken();
    accessToken = typeof tokenResult === 'string' ? tokenResult : (tokenResult?.token || '');
    if (!accessToken) {
      throw new Error('Failed to retrieve OAuth2 access token from Google');
    }
  } catch (error: any) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Google Service Account authentication failed: ${error.message}`
    );
  }

  const packageName = config.iap.googlePackageName;
  const baseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

  let purchaseData: any;
  try {
    const response = await axios.get(baseUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    purchaseData = response.data;
  } catch (error: any) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to verify purchase token with Google Play: ${
        error.response?.data?.error?.message || error.message
      }`
    );
  }

  // Check state
  const activeStates = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  ];
  const currentState = purchaseData.subscriptionState;

  if (!activeStates.includes(currentState)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Subscription is not active in Google Play. Current state: ${currentState}`
    );
  }

  // Extract expiry time from line items
  const lineItem =
    purchaseData.lineItems?.find((i: any) => i.productId === productId) ||
    purchaseData.lineItems?.[0];

  if (!lineItem?.expiryTime) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Could not determine subscription expiry date from Google Play data'
    );
  }

  const expiresAt = new Date(lineItem.expiryTime);
  const isPremium = expiresAt.getTime() > Date.now();
  const userObjectId = new Types.ObjectId(userId);

  // Idempotent Acknowledgment Check (INV-03):
  // Google will HTTP 400 if :acknowledge is called on an already acknowledged token.
  if (
    purchaseData.acknowledgementState ===
    'ACKNOWLEDGEMENT_STATE_PENDING_PURCHASE_ACKNOWLEDGEMENT'
  ) {
    try {
      await axios.post(
        `${baseUrl}:acknowledge`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );
    } catch (ackError: any) {
      // If already acknowledged, we can safely proceed; otherwise log warning
      if (ackError.response?.status !== 400) {
        console.warn(
          'Google purchase acknowledge warning:',
          ackError.response?.data || ackError.message
        );
      }
    }
  }

  // Anti-Hijacking Check (INV-01)
  const existingWithSameToken =
    await SubscriptionModel.findByPurchaseToken(purchaseToken);
  if (
    existingWithSameToken &&
    existingWithSameToken.userId.toString() !== userObjectId.toString() &&
    existingWithSameToken.isPremium &&
    existingWithSameToken.expiresAt &&
    existingWithSameToken.expiresAt.getTime() > Date.now()
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This Google Play purchase token is already active on another account'
    );
  }

  // Save to database
  await SubscriptionModel.upsertForUser(userObjectId, {
    plan: SUBSCRIPTION_PLAN.YEARLY,
    status: isPremium ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.INACTIVE,
    isPremium,
    platform: SUBSCRIPTION_PLATFORM.ANDROID,
    productId: productId || config.iap.productId,
    purchaseToken,
    orderId,
    expiresAt,
    currentPeriodEnd: expiresAt,
  });

  return {
    isPremium,
    expiresAt,
    productId: productId || config.iap.productId,
    platform: 'android',
    orderId,
  };
};

/**
 * Restores purchases for a user.
 * Supports live re-validation if receipt or token is supplied, or falls back to DB status.
 */
export const restorePurchases = async (
  userId: string,
  receipt?: string,
  purchaseToken?: string
): Promise<ISubscriptionStatusResult> => {
  if (receipt) {
    const result = await verifyAppleReceipt(receipt, userId);
    return {
      isPremium: result.isPremium,
      expiresAt: result.expiresAt,
      platform: result.platform,
      productId: result.productId,
    };
  }

  if (purchaseToken) {
    const result = await verifyGooglePurchase(
      purchaseToken,
      config.iap.productId,
      '',
      userId
    );
    return {
      isPremium: result.isPremium,
      expiresAt: result.expiresAt,
      platform: result.platform,
      productId: result.productId,
    };
  }

  return await getSubscriptionStatus(userId);
};

/**
 * Returns current subscription status for a user.
 */
export const getSubscriptionStatus = async (
  userId: string
): Promise<ISubscriptionStatusResult> => {
  const userObjectId = new Types.ObjectId(userId);
  const sub = await SubscriptionModel.findByUser(userObjectId);

  if (!sub) {
    return { isPremium: false };
  }

  const now = Date.now();
  let isPremium = false;
  let effectiveExpiry = sub.expiresAt || sub.currentPeriodEnd || null;

  if (effectiveExpiry && effectiveExpiry.getTime() > now) {
    isPremium = true;
  } else if (sub.status === SUBSCRIPTION_STATUS.ACTIVE && !effectiveExpiry) {
    // If active without explicit expiry date (e.g., active Stripe recurring)
    isPremium = true;
  }

  // Auto-sync status if expired in DB
  if (!isPremium && sub.isPremium) {
    await SubscriptionModel.updateOne(
      { _id: sub._id },
      { $set: { isPremium: false, status: SUBSCRIPTION_STATUS.INACTIVE } }
    );
  }

  return {
    isPremium,
    expiresAt: effectiveExpiry,
    platform: sub.platform,
    productId: sub.productId || config.iap.productId,
  };
};

/**
 * Apple Server-to-Server Notifications v2 Handler
 */
export const handleAppleWebhook = async (payload: any): Promise<boolean> => {
  if (!payload) return false;

  const signedPayload = payload.signedPayload;
  let decodedPayload: any = payload;

  if (signedPayload && typeof signedPayload === 'string') {
    try {
      decodedPayload = jwt.decode(signedPayload);
    } catch {
      decodedPayload = payload;
    }
  }

  const notificationType = decodedPayload?.notificationType;
  const transactionInfo = decodedPayload?.data?.signedTransactionInfo;
  let decodedTxn: any = null;

  if (transactionInfo && typeof transactionInfo === 'string') {
    try {
      decodedTxn = jwt.decode(transactionInfo);
    } catch {
      decodedTxn = null;
    }
  }

  const originalTxnId =
    decodedTxn?.originalTransactionId || decodedPayload?.data?.originalTransactionId;

  if (!originalTxnId) {
    return false;
  }

  const sub = await SubscriptionModel.findByOriginalTxnId(originalTxnId);
  if (!sub) {
    return false;
  }

  const expiresDateMs = decodedTxn?.expiresDate;
  const newExpiry = expiresDateMs ? new Date(Number(expiresDateMs)) : null;

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW': {
      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            isPremium: true,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            expiresAt: newExpiry || sub.expiresAt,
            currentPeriodEnd: newExpiry || sub.currentPeriodEnd,
            latestTransactionId: decodedTxn?.transactionId || sub.latestTransactionId,
          },
        }
      );
      break;
    }
    case 'EXPIRED':
    case 'REFUND':
    case 'REVOKE':
    case 'GRACE_PERIOD_EXPIRED': {
      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            isPremium: false,
            status: SUBSCRIPTION_STATUS.CANCELED,
          },
        }
      );
      break;
    }
    default:
      break;
  }

  return true;
};

/**
 * Google Cloud Pub/Sub Real-Time Developer Notifications (RTDN) Webhook Handler
 */
export const handleGoogleWebhook = async (payload: any): Promise<boolean> => {
  if (!payload) return false;

  // Google Cloud Pub/Sub push message format: { message: { data: "base64...", messageId: "..." } }
  const rawData = payload?.message?.data;
  let decodedString = '';

  if (rawData && typeof rawData === 'string') {
    try {
      decodedString = Buffer.from(rawData, 'base64').toString('utf-8');
    } catch {
      decodedString = rawData;
    }
  } else if (typeof payload === 'string') {
    decodedString = payload;
  } else if (payload?.subscriptionNotification || payload?.testNotification) {
    decodedString = JSON.stringify(payload);
  }

  let notificationData: any = null;
  try {
    notificationData = JSON.parse(decodedString);
  } catch {
    notificationData = payload;
  }

  // Handle Google Pub/Sub verification test notification
  if (notificationData?.testNotification) {
    return true;
  }

  const subNotification =
    notificationData?.subscriptionNotification ||
    (notificationData?.purchaseToken ? notificationData : null);
  if (!subNotification) {
    return true; // Acknowledge non-subscription messages safely
  }

  const { notificationType, purchaseToken, subscriptionId } = subNotification;
  if (!purchaseToken) {
    return true;
  }

  const sub = await SubscriptionModel.findByPurchaseToken(purchaseToken);
  if (!sub) {
    return true;
  }

  /*
   Google notificationType reference:
   1 = SUBSCRIPTION_RECOVERED
   2 = SUBSCRIPTION_RENEWED
   3 = SUBSCRIPTION_CANCELED (user turned off auto-renew; still entitled until expiresAt!)
   4 = SUBSCRIPTION_PURCHASED
   5 = SUBSCRIPTION_ON_HOLD
   6 = SUBSCRIPTION_IN_GRACE_PERIOD
   7 = SUBSCRIPTION_RESTARTED
   12 = SUBSCRIPTION_REVOKED (refunded by Google/support - immediately revoke)
   13 = SUBSCRIPTION_EXPIRED (grace period or billing ended - revoke)
  */

  switch (notificationType) {
    case 1: // RECOVERED
    case 2: // RENEWED
    case 7: { // RESTARTED
      // When renewed or recovered, query Google API if possible to get updated expiryTime
      try {
        if (fs.existsSync(config.iap.googleServiceAccountKeyPath)) {
          const authClient = new GoogleAuth({
            keyFile: config.iap.googleServiceAccountKeyPath,
            scopes: ['https://www.googleapis.com/auth/androidpublisher'],
          });
          const tokenResult: any = await authClient.getAccessToken();
          const accessToken =
            typeof tokenResult === 'string'
              ? tokenResult
              : tokenResult?.token || '';
          if (accessToken) {
            const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${config.iap.googlePackageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
            const apiRes = await axios.get(url, {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 10000,
            });
            const lineItem =
              apiRes.data?.lineItems?.find(
                (i: any) =>
                  i.productId === (subscriptionId || config.iap.productId)
              ) || apiRes.data?.lineItems?.[0];

            if (lineItem?.expiryTime) {
              const newExpiry = new Date(lineItem.expiryTime);
              await SubscriptionModel.updateOne(
                { _id: sub._id },
                {
                  $set: {
                    isPremium: newExpiry.getTime() > Date.now(),
                    status: SUBSCRIPTION_STATUS.ACTIVE,
                    expiresAt: newExpiry,
                    currentPeriodEnd: newExpiry,
                  },
                }
              );
              return true;
            }
          }
        }
      } catch (err: any) {
        console.warn('Google RTDN renew auto-fetch warning:', err?.message);
      }

      // Fallback: If live API fetch failed, extend 1 year
      const fallbackExpiry =
        sub.expiresAt && sub.expiresAt.getTime() > Date.now()
          ? new Date(sub.expiresAt.getTime() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            isPremium: true,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            expiresAt: fallbackExpiry,
            currentPeriodEnd: fallbackExpiry,
          },
        }
      );
      break;
    }

    case 3: { // SUBSCRIPTION_CANCELED
      // Do NOT revoke immediately! User already paid for the full period.
      // Update status to CANCELED, but keep isPremium active until expiresAt.
      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            status: SUBSCRIPTION_STATUS.CANCELED,
            isPremium: sub.expiresAt ? sub.expiresAt.getTime() > Date.now() : true,
          },
        }
      );
      break;
    }

    case 5: // ON_HOLD
    case 6: { // IN_GRACE_PERIOD
      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            status: SUBSCRIPTION_STATUS.PAST_DUE,
          },
        }
      );
      break;
    }

    case 12: // REVOKED (Refunded)
    case 13: { // EXPIRED
      await SubscriptionModel.updateOne(
        { _id: sub._id },
        {
          $set: {
            isPremium: false,
            status: SUBSCRIPTION_STATUS.INACTIVE,
          },
        }
      );
      break;
    }

    default:
      break;
  }

  return true;
};

const IapService = {
  verifyAppleReceipt,
  verifyGooglePurchase,
  restorePurchases,
  getSubscriptionStatus,
  handleAppleWebhook,
  handleGoogleWebhook,
};

export default IapService;

