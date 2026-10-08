import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { USER_ROLES, ACCOUNT_STATE } from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import { BusinessLead } from '../lead.model';
import { emailHelper } from '../../../../helpers/emailHelper';
import { vi } from 'vitest';

let replSet: MongoMemoryReplSet;
let promoterToken: string;
let promoterUserId: string;

vi.spyOn(emailHelper, 'sendEmail').mockResolvedValue(undefined as any);

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  if (BusinessLead) await BusinessLead.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  // Ensure connection is fully closed before stopping memory server
  while (mongoose.connection.readyState !== 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (replSet) {
    await replSet.stop();
  }
});

describe('Promoter Journey E2E Test', () => {
  it('Step 1: Promoter registers successfully', async () => {
    const payload = {
      name: 'Test Promoter',
      email: 'promoter_journey@test.com',
      password: 'Password123!',
      phone: '01912345678',
      role: USER_ROLES.PROMOTER,
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');

    promoterUserId = res.body.data.userId;

    // Verify DB state
    const dbUser = await User.findById(promoterUserId);
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe(USER_ROLES.PROMOTER);

    // Manually verify the user and generate a token to bypass OTP logic for subsequent steps
    await User.findByIdAndUpdate(promoterUserId, {
      accountState: ACCOUNT_STATE.VERIFIED,
    });

    promoterToken = jwtHelper.createToken(
      {
        id: promoterUserId,
        userId: promoterUserId,
        role: USER_ROLES.PROMOTER,
        email: 'promoter_journey@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );
  });

  it('Step 2: Promoter successfully submits a new lead', async () => {
    const payload = {
      businessName: 'Awesome Tech Business',
      ownerName: 'John Doe',
      phone: '01711122233',
      email: 'johndoe@awesometech.com',
      address: '123 Tech Street, Silicon Valley',
    };

    const res = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send(payload);

    console.log(
      `\n[API LOG] POST /api/v1/leads\n` +
        `💡 Purpose: Promoter submits a new business lead.\n` +
        `⬆️ REQUEST Payload:\n${JSON.stringify(payload, null, 2)}\n` +
        `⬇️ RESPONSE Status: ${res.status}\n` +
        `⬇️ RESPONSE Body:\n${JSON.stringify(res.body, null, 2)}\n`,
    );

    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.success).toBe(true);

    // Verify DB state
    const dbLead = await BusinessLead.findOne({
      email: 'johndoe@awesometech.com',
    });
    expect(dbLead).not.toBeNull();
    expect(dbLead?.businessName).toBe('Awesome Tech Business');
  });

  it('Step 3: Admin retrieves all leads', async () => {
    // 1. Create an admin user to get the token
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_leads@test.com',
      password: 'Password123!',
      phone: '01812345678',
      role: USER_ROLES.ADMIN,
      accountState: ACCOUNT_STATE.VERIFIED,
    });

    const adminToken = jwtHelper.createToken(
      {
        id: adminUser._id.toString(),
        userId: adminUser._id.toString(),
        role: USER_ROLES.ADMIN,
        email: adminUser.email,
      },
      config.jwt.jwt_secret as string,
      '1h',
    );

    // 2. Fetch leads with admin token
    const res = await request(app)
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    console.log(
      `\n[API LOG] GET /api/v1/leads\n` +
        `💡 Purpose: Admin retrieves all business leads.\n` +
        `⬆️ REQUEST Payload: None\n` +
        `⬇️ RESPONSE Status: ${res.status}\n` +
        `⬇️ RESPONSE Body:\n${JSON.stringify(res.body, null, 2)}\n`,
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // We expect at least the lead created in step 2 to be here
    const lead = res.body.data.find(
      (l: any) => l.email === 'johndoe@awesometech.com',
    );
    expect(lead).toBeDefined();
    expect(lead.businessName).toBe('Awesome Tech Business');
  });
  it('Step 4: Admin updates lead status to IN_PROGRESS', async () => {
    const lead = await BusinessLead.findOne({ email: 'johndoe@awesometech.com' });
    const payload = { status: 'IN_PROGRESS' };

    const adminToken = jwtHelper.createToken(
      {
        id: (await User.findOne({ email: 'admin_leads@test.com' }))?._id.toString() as string,
        userId: (await User.findOne({ email: 'admin_leads@test.com' }))?._id.toString() as string,
        role: USER_ROLES.ADMIN,
        email: 'admin_leads@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );

    const res = await request(app)
      .patch(`/api/v1/leads/${lead?._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    console.log(
      `\n[API LOG] PATCH /api/v1/leads/:id/status\n` +
        `💡 Purpose: Admin updates the lead status to IN_PROGRESS.\n` +
        `⬆️ REQUEST Payload:\n${JSON.stringify(payload, null, 2)}\n` +
        `⬇️ RESPONSE Status: ${res.status}\n` +
        `⬇️ RESPONSE Body:\n${JSON.stringify(res.body, null, 2)}\n`,
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('Step 5: Promoter retrieves their own leads', async () => {
    const res = await request(app)
      .get('/api/v1/leads/my-leads')
      .set('Authorization', `Bearer ${promoterToken}`);

    console.log(
      `\n[API LOG] GET /api/v1/leads/my-leads\n` +
        `💡 Purpose: Promoter retrieves their own submitted leads.\n` +
        `⬆️ REQUEST Payload: None\n` +
        `⬇️ RESPONSE Status: ${res.status}\n` +
        `⬇️ RESPONSE Body:\n${JSON.stringify(res.body, null, 2)}\n`,
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].status).toBe('IN_PROGRESS');
  });

  it('Step 6: Admin updates lead status to REJECTED with note', async () => {
    const lead = await BusinessLead.findOne({ email: 'johndoe@awesometech.com' });
    const payload = { 
      status: 'REJECTED', 
      adminNote: 'Called them, fake number', 
      rejectReason: 'Fake phone number' 
    };

    const adminToken = jwtHelper.createToken(
      {
        id: (await User.findOne({ email: 'admin_leads@test.com' }))?._id.toString() as string,
        userId: (await User.findOne({ email: 'admin_leads@test.com' }))?._id.toString() as string,
        role: USER_ROLES.ADMIN,
        email: 'admin_leads@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );

    const res = await request(app)
      .patch(`/api/v1/leads/${lead?._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    console.log(
      `\n[API LOG] PATCH /api/v1/leads/:id/status\n` +
        `💡 Purpose: Admin rejects the lead and adds internal notes.\n` +
        `⬆️ REQUEST Payload:\n${JSON.stringify(payload, null, 2)}\n` +
        `⬇️ RESPONSE Status: ${res.status}\n` +
        `⬇️ RESPONSE Body:\n${JSON.stringify(res.body, null, 2)}\n`,
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectReason).toBe('Fake phone number');
  });
});
