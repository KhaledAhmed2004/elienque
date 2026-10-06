import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import supertest from 'supertest';
import express from 'express';
import { CampaignRoutes } from '../src/app/modules/campaign/campaign.route';
import { User } from '../src/app/modules/user/user.model';
import { USER_ROLES, ACCOUNT_STATE } from '../src/enums/user';
import { Campaign } from '../src/app/modules/campaign/campaign.model';
import { CampaignParticipant } from '../src/app/modules/campaign/campaignParticipant.model';
import jwt from 'jsonwebtoken';
import globalErrorHandler from '../src/app/middlewares/globalErrorHandler';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Setup standalone app to avoid broken auth imports in the main router
const app = express();
app.use(express.json());
// Mock request user assignment so we don't even need the real auth middleware if it's too broken,
// but let's mount the routes natively. 
// Actually, our route uses the real auth middleware, but we'll mock the token payload carefully.
// Wait, the real auth middleware requires accountState to not throw (if we fix it) or we just inject a mock auth.
// But we want to use the real route. We'll fix auth middleware before running.

app.use('/api/v1/campaigns', CampaignRoutes);
app.use(globalErrorHandler);

async function verify() {
  await mongoose.connect(process.env.DATABASE_URL!);
  console.log('Connected to DB');

  const request = supertest(app);

  // Clear previous test data
  await User.deleteMany({ email: { $in: ['bo@test.com', 'pro@test.com'] } });
  
  const boUser = await User.create({
    name: 'Test BO',
    email: 'bo@test.com',
    password: 'Password123!',
    phone: '1234567890',
    role: USER_ROLES.BUSINESS_OWNER,
    accountState: ACCOUNT_STATE.VERIFIED
  });

  const proUser = await User.create({
    name: 'Test Pro',
    email: 'pro@test.com',
    password: 'Password123!',
    phone: '0987654321',
    role: USER_ROLES.PROMOTER,
    accountState: ACCOUNT_STATE.VERIFIED
  });

  const boToken = jwt.sign(
    { id: boUser._id, role: boUser.role, email: boUser.email, accountState: boUser.accountState },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  const proToken = jwt.sign(
    { id: proUser._id, role: proUser.role, email: proUser.email, accountState: proUser.accountState },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  await Campaign.deleteMany({ businessId: boUser._id });

  console.log('\n--- AC-1: Create Campaign (Draft) ---');
  let res = await request.post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${boToken}`)
    .send({
      title: 'Summer Sale',
      reward: '10 points',
      offer: '20% off',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
  console.log('POST /api/v1/campaigns =>', res.status, res.body);
  const campaignId = res.body.data?.id || res.body.data?._id;
  
  console.log('\n--- AC-2: Edit Campaign (Draft) ---');
  res = await request.put(`/api/v1/campaigns/${campaignId}`)
    .set('Authorization', `Bearer ${boToken}`)
    .send({ title: 'Winter Sale' });
  console.log(`PUT /api/v1/campaigns/${campaignId} =>`, res.status, res.body);

  console.log('\n--- AC-5: Join Draft Campaign (Should Fail) ---');
  res = await request.post(`/api/v1/campaigns/${campaignId}/join`)
    .set('Authorization', `Bearer ${proToken}`);
  console.log(`POST /api/v1/campaigns/${campaignId}/join =>`, res.status, res.body);

  console.log('\n--- Activate Campaign ---');
  res = await request.post(`/api/v1/campaigns/${campaignId}/activate`)
    .set('Authorization', `Bearer ${boToken}`);
  console.log(`POST /api/v1/campaigns/${campaignId}/activate =>`, res.status, res.body);

  console.log('\n--- AC-3: List Active Campaigns ---');
  res = await request.get('/api/v1/campaigns')
    .set('Authorization', `Bearer ${proToken}`);
  console.log(`GET /api/v1/campaigns =>`, res.status, res.body.data?.length, 'campaigns found');

  console.log('\n--- AC-4: Join Active Campaign ---');
  res = await request.post(`/api/v1/campaigns/${campaignId}/join`)
    .set('Authorization', `Bearer ${proToken}`);
  console.log(`POST /api/v1/campaigns/${campaignId}/join =>`, res.status, res.body);

  console.log('\n--- Clean up ---');
  await User.deleteMany({ email: { $in: ['bo@test.com', 'pro@test.com'] } });
  await Campaign.deleteMany({ businessId: boUser._id });
  await CampaignParticipant.deleteMany({ promoterId: proUser._id });
  await mongoose.disconnect();
}

verify().catch(console.error);
