import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import express from 'express';
import { CampaignRoutes } from '../campaign.route';
import globalErrorHandler from '../../../../app/middlewares/globalErrorHandler';

const app = express();
app.use(express.json());
app.use('/api/v1/campaigns', CampaignRoutes);
app.use(globalErrorHandler);

import { User } from '../../user/user.model';
import { Campaign } from '../campaign.model';
import { CampaignParticipant } from '../campaignParticipant.model';
import { USER_ROLES, ACCOUNT_STATE } from '../../../../enums/user';
import config from '../../../../config';

describe('Campaign Management E2E (Happy Path)', () => {
  let request: supertest.SuperTest<supertest.Test>;
  let boUser: any;
  let proUser: any;
  let boToken: string;
  let proToken: string;
  let campaignId: string;

  beforeAll(async () => {
    // Assuming global setup connects to DB, or we can connect here for local test runner:
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.database_url as string);
    }
    
    request = supertest(app);

    // Clean up
    await User.deleteMany({ email: { $in: ['bo@test.com', 'pro@test.com'] } });
    
    // Seed test users
    boUser = await User.create({
      name: 'Test BO',
      email: 'bo@test.com',
      password: 'Password123!',
      phone: '1234567890',
      role: USER_ROLES.BUSINESS_OWNER,
      accountState: ACCOUNT_STATE.VERIFIED
    });

    proUser = await User.create({
      name: 'Test Pro',
      email: 'pro@test.com',
      password: 'Password123!',
      phone: '0987654321',
      role: USER_ROLES.PROMOTER,
      accountState: ACCOUNT_STATE.VERIFIED
    });

    boToken = jwt.sign(
      { id: boUser._id, role: boUser.role, email: boUser.email, accountState: boUser.accountState },
      config.jwt.jwt_secret as string,
      { expiresIn: '1h' }
    );

    proToken = jwt.sign(
      { id: proUser._id, role: proUser.role, email: proUser.email, accountState: proUser.accountState },
      config.jwt.jwt_secret as string,
      { expiresIn: '1h' }
    );

    await Campaign.deleteMany({ businessId: boUser._id });
    await CampaignParticipant.deleteMany({ promoterId: proUser._id });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['bo@test.com', 'pro@test.com'] } });
    await Campaign.deleteMany({ businessId: boUser._id });
    await CampaignParticipant.deleteMany({ promoterId: proUser._id });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('AC-1: Create Campaign (Draft)', async () => {
    const res = await request.post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${boToken}`)
      .send({
        title: 'Summer Sale',
        reward: '10 points',
        offer: '20% off',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    
    campaignId = res.body.data.id || res.body.data._id;
  });

  it('AC-2: Edit Campaign (Draft)', async () => {
    const res = await request.put(`/api/v1/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${boToken}`)
      .send({ title: 'Winter Sale' });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Winter Sale');
  });

  it('AC-5: Join Draft Campaign (Should Fail)', async () => {
    const res = await request.post(`/api/v1/campaigns/${campaignId}/join`)
      .set('Authorization', `Bearer ${proToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not active/);
  });

  it('Activate Campaign', async () => {
    const res = await request.post(`/api/v1/campaigns/${campaignId}/activate`)
      .set('Authorization', `Bearer ${boToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('AC-3: List Active Campaigns', async () => {
    const res = await request.get('/api/v1/campaigns')
      .set('Authorization', `Bearer ${proToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('AC-4: Join Active Campaign', async () => {
    const res = await request.post(`/api/v1/campaigns/${campaignId}/join`)
      .set('Authorization', `Bearer ${proToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('referralCode');
  });
});
