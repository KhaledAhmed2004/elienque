import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Subscription as SubscriptionModel } from '../subscription.model';
import { USER_ROLES, COMPANY_ROLE } from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import axios from 'axios';

vi.mock('axios');

describe('Subscription & IAP End-to-End HTTP API Suite', () => {
  let replSet: MongoMemoryReplSet;
  let testUserId: string;
  let testUserToken: string;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());

    testUserId = new mongoose.Types.ObjectId().toString();
    await User.create({
      _id: testUserId,
      name: 'Test Member',
      email: 'member-iap@test.com',
      password: 'Password123!',
      phone: '+12345678901',
      role: USER_ROLES.USER,
      companyRole: COMPANY_ROLE.CHAUFFEUR,
      accountState: 'VERIFIED',
    });

    testUserToken = jwtHelper.createToken(
      { id: testUserId, userId: testUserId, role: USER_ROLES.USER, email: 'member-iap@test.com' },
      config.jwt.jwt_secret as string,
      '1h'
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await SubscriptionModel.deleteMany({});
  });

  describe('5-Tier Authorization & Validation Gates', () => {
    it('rejects unauthenticated requests to /subscriptions/status with 401', async () => {
      const res = await request(app).get('/api/v1/subscriptions/status');
      expect(res.status).toBe(401);
    });

    it('rejects /verify-apple with 400 when receipt is missing or empty', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/verify-apple')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ receipt: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects /verify-google with 400 when purchaseToken or productId missing', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/verify-google')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ purchaseToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Apple Verification & Dual-Routing (/subscriptions & /subscription)', () => {
    it('verifies Apple receipt via /api/v1/subscriptions/verify-apple and updates DB', async () => {
      const futureExpiryMs = (Date.now() + 365 * 24 * 60 * 60 * 1000).toString();
      vi.mocked(axios.post).mockResolvedValueOnce({
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
      });

      const res = await request(app)
        .post('/api/v1/subscriptions/verify-apple')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ receipt: 'MIIUKgYJKoZIhvcNAQcCoIIU...' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPremium).toBe(true);
      expect(res.body.data.platform).toBe('ios');
      expect(res.body.data.productId).toBe('ekkali_premium_yearly');

      // Verify persistence in MongoDB
      const saved = await SubscriptionModel.findOne({ userId: testUserId });
      expect(saved).toBeDefined();
      expect(saved?.isPremium).toBe(true);
      expect(saved?.originalTransactionId).toBe('1000000123456789');
    });

    it('works identically via singular alias /api/v1/subscription/verify-apple', async () => {
      const futureExpiryMs = (Date.now() + 365 * 24 * 60 * 60 * 1000).toString();
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          status: 0,
          latest_receipt_info: [
            {
              product_id: 'ekkali_premium_yearly',
              transaction_id: '888888',
              original_transaction_id: '999999',
              expires_date_ms: futureExpiryMs,
            },
          ],
        },
      });

      const res = await request(app)
        .post('/api/v1/subscription/verify-apple')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ receipt: 'valid_sample_receipt' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPremium).toBe(true);
    });
  });

  describe('Status, Restore & Webhook Pipelines', () => {
    it('returns subscription status from GET /api/v1/subscriptions/status', async () => {
      // First save an active subscription in DB
      await SubscriptionModel.create({
        userId: testUserId,
        isPremium: true,
        platform: 'ios',
        productId: 'ekkali_premium_yearly',
        expiresAt: new Date(Date.now() + 10000000),
      });

      const res = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPremium).toBe(true);
      expect(res.body.data.productId).toBe('ekkali_premium_yearly');
    });

    it('restores purchase via POST /api/v1/subscriptions/restore', async () => {
      await SubscriptionModel.create({
        userId: testUserId,
        isPremium: true,
        platform: 'ios',
        productId: 'ekkali_premium_yearly',
        expiresAt: new Date(Date.now() + 50000000),
      });

      const res = await request(app)
        .post('/api/v1/subscriptions/restore')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPremium).toBe(true);
    });

    it('processes Apple Server Notifications webhook via POST /api/v1/subscriptions/apple-webhook', async () => {
      await SubscriptionModel.create({
        userId: testUserId,
        isPremium: true,
        originalTransactionId: 'apple_txn_webhook_test',
        expiresAt: new Date(Date.now() + 1000000),
      });

      const webhookPayload = {
        notificationType: 'EXPIRED',
        data: {
          originalTransactionId: 'apple_txn_webhook_test',
        },
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/apple-webhook')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await SubscriptionModel.findOne({ userId: testUserId });
      expect(updated?.isPremium).toBe(false);
      expect(updated?.status).toBe('canceled');
    });

    it('processes Google Cloud Pub/Sub webhook via POST /api/v1/subscriptions/google-webhook', async () => {
      await SubscriptionModel.create({
        userId: testUserId,
        isPremium: true,
        purchaseToken: 'google_txn_webhook_test',
        expiresAt: new Date(Date.now() + 1000000),
      });

      const pubSubData = JSON.stringify({
        version: '1.0',
        notificationType: 13, // EXPIRED
        purchaseToken: 'google_txn_webhook_test',
        subscriptionId: 'ekkali_premium_yearly',
      });
      const base64Data = Buffer.from(pubSubData).toString('base64');

      const res = await request(app)
        .post('/api/v1/subscriptions/google-webhook')
        .send({
          message: {
            data: base64Data,
            messageId: 'pubsub_msg_999',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await SubscriptionModel.findOne({ userId: testUserId });
      expect(updated?.isPremium).toBe(false);
      expect(updated?.status).toBe('inactive');
    });
  });
});
