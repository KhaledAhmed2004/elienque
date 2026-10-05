import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { Types } from 'mongoose';
import httpStatus from 'http-status';
import {
  verifyAppleReceipt,
  verifyGooglePurchase,
  restorePurchases,
  getSubscriptionStatus,
  handleAppleWebhook,
  handleGoogleWebhook,
} from '../iap.service';
import { Subscription as SubscriptionModel } from '../subscription.model';
import { SubscriptionValidation } from '../subscription.validation';
import {
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLATFORM,
} from '../subscription.interface';
import config from '../../../../config';

vi.mock('axios');

describe('In-App Purchase (IAP) Test Suite', () => {
  const userA = new Types.ObjectId().toString();
  const userB = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Zod Validation Schemas', () => {
    it('verifyAppleSchema should reject empty receipt', () => {
      const result = SubscriptionValidation.verifyAppleSchema.safeParse({
        body: { receipt: '' },
      });
      expect(result.success).toBe(false);
    });

    it('verifyAppleSchema should accept valid receipt string', () => {
      const result = SubscriptionValidation.verifyAppleSchema.safeParse({
        body: { receipt: 'MIIUKgYJKoZIhvcNAQcCoIIU...' },
      });
      expect(result.success).toBe(true);
    });

    it('verifyGoogleSchema should reject missing purchaseToken or productId', () => {
      const result = SubscriptionValidation.verifyGoogleSchema.safeParse({
        body: { purchaseToken: '', productId: '' },
      });
      expect(result.success).toBe(false);
    });

    it('verifyGoogleSchema should accept valid purchase payload', () => {
      const result = SubscriptionValidation.verifyGoogleSchema.safeParse({
        body: {
          purchaseToken: 'token_abc123',
          productId: 'ekkali_premium_yearly',
          orderId: 'GPA.1234-5678',
        },
      });
      expect(result.success).toBe(true);
    });

    it('restoreSchema should accept empty body {}', () => {
      const result = SubscriptionValidation.restoreSchema.safeParse({
        body: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Apple Receipt Verification', () => {
    it('successfully verifies an active Apple receipt (status 0)', async () => {
      const futureExpiryMs = (Date.now() + 365 * 24 * 60 * 60 * 1000).toString();
      const mockAppleResponse = {
        data: {
          status: 0,
          latest_receipt_info: [
            {
              product_id: 'ekkali_premium_yearly',
              transaction_id: '1000000987654321',
              original_transaction_id: '1000000123456789',
              expires_date_ms: futureExpiryMs,
            },
          ],
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockAppleResponse);
      vi.spyOn(SubscriptionModel, 'findByOriginalTxnId').mockResolvedValueOnce(null);
      vi.spyOn(SubscriptionModel, 'upsertForUser').mockResolvedValueOnce({} as any);

      const res = await verifyAppleReceipt('valid_receipt_string', userA);

      expect(res.isPremium).toBe(true);
      expect(res.platform).toBe('ios');
      expect(res.productId).toBe('ekkali_premium_yearly');
      expect(res.transactionId).toBe('1000000987654321');
      expect(SubscriptionModel.upsertForUser).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        expect.objectContaining({
          isPremium: true,
          originalTransactionId: '1000000123456789',
          platform: SUBSCRIPTION_PLATFORM.IOS,
        })
      );
    });

    it('handles status 21007 by automatically falling back to Apple Sandbox server', async () => {
      const futureExpiryMs = (Date.now() + 30 * 24 * 60 * 60 * 1000).toString();

      // First call (Production) returns 21007
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { status: 21007 },
      });

      // Second call (Sandbox) returns 0
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          status: 0,
          latest_receipt_info: [
            {
              product_id: 'ekkali_premium_yearly',
              transaction_id: '2000000111222333',
              original_transaction_id: '2000000111222333',
              expires_date_ms: futureExpiryMs,
            },
          ],
        },
      });

      vi.spyOn(SubscriptionModel, 'findByOriginalTxnId').mockResolvedValueOnce(null);
      vi.spyOn(SubscriptionModel, 'upsertForUser').mockResolvedValueOnce({} as any);

      const res = await verifyAppleReceipt('sandbox_receipt', userA);

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(res.isPremium).toBe(true);
      expect(res.transactionId).toBe('2000000111222333');
    });

    it('enforces Anti-Account-Hijacking (INV-01) by throwing 409 Conflict if receipt is active on another account', async () => {
      const futureExpiry = new Date(Date.now() + 1000000);
      const mockAppleResponse = {
        data: {
          status: 0,
          latest_receipt_info: [
            {
              product_id: 'ekkali_premium_yearly',
              transaction_id: 'txn_123',
              original_transaction_id: 'orig_123',
              expires_date_ms: futureExpiry.getTime().toString(),
            },
          ],
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockAppleResponse);
      vi.spyOn(SubscriptionModel, 'findByOriginalTxnId').mockResolvedValueOnce({
        userId: new Types.ObjectId(userB), // Different user!
        isPremium: true,
        expiresAt: futureExpiry,
      } as any);

      await expect(verifyAppleReceipt('receipt_data', userA)).rejects.toMatchObject({
        statusCode: httpStatus.CONFLICT,
        message: expect.stringContaining('already active on another account'),
      });
    });
  });

  describe('Smart Restore & Status Resolution', () => {
    it('getSubscriptionStatus returns isPremium: true for active unexpired subscription', async () => {
      const futureExpiry = new Date(Date.now() + 20000000);
      vi.spyOn(SubscriptionModel, 'findByUser').mockResolvedValueOnce({
        isPremium: true,
        expiresAt: futureExpiry,
        platform: SUBSCRIPTION_PLATFORM.IOS,
        productId: 'ekkali_premium_yearly',
      } as any);

      const res = await getSubscriptionStatus(userA);
      expect(res.isPremium).toBe(true);
      expect(res.expiresAt).toEqual(futureExpiry);
    });

    it('getSubscriptionStatus returns isPremium: false for expired subscription', async () => {
      const pastExpiry = new Date(Date.now() - 50000);
      vi.spyOn(SubscriptionModel, 'findByUser').mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        isPremium: true,
        expiresAt: pastExpiry,
        platform: SUBSCRIPTION_PLATFORM.ANDROID,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const res = await getSubscriptionStatus(userA);
      expect(res.isPremium).toBe(false);
      expect(SubscriptionModel.updateOne).toHaveBeenCalled();
    });

    it('restorePurchases without tokens falls back to getSubscriptionStatus', async () => {
      const futureExpiry = new Date(Date.now() + 5000000);
      vi.spyOn(SubscriptionModel, 'findByUser').mockResolvedValueOnce({
        isPremium: true,
        expiresAt: futureExpiry,
        platform: SUBSCRIPTION_PLATFORM.IOS,
        productId: 'ekkali_premium_yearly',
      } as any);

      const res = await restorePurchases(userA);
      expect(res.isPremium).toBe(true);
      expect(res.productId).toBe('ekkali_premium_yearly');
    });
  });

  describe('Apple Server Notifications v2 Webhook', () => {
    it('updates subscription on DID_RENEW', async () => {
      const subId = new Types.ObjectId();
      vi.spyOn(SubscriptionModel, 'findByOriginalTxnId').mockResolvedValueOnce({
        _id: subId,
        isPremium: true,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const payload = {
        notificationType: 'DID_RENEW',
        data: {
          originalTransactionId: 'orig_sub_123',
        },
      };

      const result = await handleAppleWebhook(payload);
      expect(result).toBe(true);
      expect(SubscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: subId },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPremium: true,
            status: SUBSCRIPTION_STATUS.ACTIVE,
          }),
        })
      );
    });

    it('cancels subscription on EXPIRED or REFUND', async () => {
      const subId = new Types.ObjectId();
      vi.spyOn(SubscriptionModel, 'findByOriginalTxnId').mockResolvedValueOnce({
        _id: subId,
        isPremium: true,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const payload = {
        notificationType: 'REFUND',
        data: {
          originalTransactionId: 'orig_sub_123',
        },
      };

      const result = await handleAppleWebhook(payload);
      expect(result).toBe(true);
      expect(SubscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: subId },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPremium: false,
            status: SUBSCRIPTION_STATUS.CANCELED,
          }),
        })
      );
    });
  });

  describe('Google Cloud Pub/Sub Webhook', () => {
    it('handles SUBSCRIPTION_RENEWED (type 2) from base64 data', async () => {
      const subId = new Types.ObjectId();
      const currentExpiry = new Date(Date.now() + 1000000);
      vi.spyOn(SubscriptionModel, 'findByPurchaseToken').mockResolvedValueOnce({
        _id: subId,
        isPremium: true,
        expiresAt: currentExpiry,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const pubSubData = JSON.stringify({
        version: '1.0',
        notificationType: 2, // SUBSCRIPTION_RENEWED
        purchaseToken: 'google_token_test_123',
        subscriptionId: 'ekkali_premium_yearly',
      });
      const base64Data = Buffer.from(pubSubData).toString('base64');

      const payload = {
        message: {
          data: base64Data,
          messageId: 'msg_123',
        },
      };

      const result = await handleGoogleWebhook(payload);
      expect(result).toBe(true);
      expect(SubscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: subId },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPremium: true,
            status: SUBSCRIPTION_STATUS.ACTIVE,
          }),
        })
      );
    });

    it('handles SUBSCRIPTION_CANCELED (type 3) without cutting off unexpired period', async () => {
      const subId = new Types.ObjectId();
      const futureExpiry = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000); // 200 days left
      vi.spyOn(SubscriptionModel, 'findByPurchaseToken').mockResolvedValueOnce({
        _id: subId,
        isPremium: true,
        expiresAt: futureExpiry,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const payload = {
        subscriptionNotification: {
          notificationType: 3, // SUBSCRIPTION_CANCELED
          purchaseToken: 'google_token_test_123',
        },
      };

      const result = await handleGoogleWebhook(payload);
      expect(result).toBe(true);
      expect(SubscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: subId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: SUBSCRIPTION_STATUS.CANCELED,
            isPremium: true, // Still true because 200 days remaining!
          }),
        })
      );
    });

    it('handles SUBSCRIPTION_EXPIRED (type 13) by immediately revoking isPremium', async () => {
      const subId = new Types.ObjectId();
      vi.spyOn(SubscriptionModel, 'findByPurchaseToken').mockResolvedValueOnce({
        _id: subId,
        isPremium: true,
      } as any);
      vi.spyOn(SubscriptionModel, 'updateOne').mockResolvedValueOnce({} as any);

      const payload = {
        subscriptionNotification: {
          notificationType: 13, // SUBSCRIPTION_EXPIRED
          purchaseToken: 'google_token_test_123',
        },
      };

      const result = await handleGoogleWebhook(payload);
      expect(result).toBe(true);
      expect(SubscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: subId },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPremium: false,
            status: SUBSCRIPTION_STATUS.INACTIVE,
          }),
        })
      );
    });
  });
});

