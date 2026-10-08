import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { USER_ROLES, ACCOUNT_STATE } from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import { BusinessLead } from '../lead.model';
import { emailHelper } from '../../../../helpers/emailHelper';
import { logApi, saveBddReport, bddReporter } from '../../../../helpers/__tests__/testLogger';

chalk.level = 3;

vi.setConfig({ testTimeout: 30000 });

const bdd = {
  header: (text: string) => chalk.bold.cyan(text),
  section: (text: string) => chalk.bold.yellow(text),
};

let replSet: MongoMemoryReplSet;
let promoterToken: string;
let promoterUserId: string;

vi.spyOn(emailHelper, 'sendEmail').mockResolvedValue(undefined as any);

beforeAll(async () => {
  const originalConsoleInfo = console.info;
  console.info = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (text.includes('USER JOURNEY') || text.includes('USER STORY')) {
      bddReporter.parseAndSetBddDoc(undefined, undefined, text);
    }
    originalConsoleInfo(...args);
  };

  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  if (BusinessLead) await BusinessLead.deleteMany({});
});

afterAll(async () => {
  saveBddReport('reports/lead-full-happy-e2e-report.html');
  await mongoose.disconnect();
  while (mongoose.connection.readyState !== 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (replSet) {
    await replSet.stop();
  }
});

describe('Promoter Lead Generation Journey - Happy Paths', () => {
  it('Step 1: Promoter registers successfully', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Promoter Onboarding')}

A new user registers as a Promoter to join the platform. They must create an account to submit leads.
`);

    const payload = {
      name: 'Test Promoter',
      email: 'promoter_journey_full@test.com',
      password: 'Password123!',
      phone: '01912345678',
      role: USER_ROLES.PROMOTER,
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload);

    logApi(
      'POST',
      '/api/v1/auth/register',
      { body: payload },
      res.body,
      'LEAD-FULL-BDD-01-REGISTER',
      'Promoter registers successfully'
    );

    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');

    promoterUserId = res.body.data.userId;

    // Verify DB state
    const dbUser = await User.findById(promoterUserId);
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe(USER_ROLES.PROMOTER);

    // Manually verify the user and generate a token
    await User.findByIdAndUpdate(promoterUserId, {
      accountState: ACCOUNT_STATE.VERIFIED,
    });

    promoterToken = jwtHelper.createToken(
      {
        id: promoterUserId,
        userId: promoterUserId,
        role: USER_ROLES.PROMOTER,
        email: 'promoter_journey_full@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );
  });

  it('Step 2: Promoter successfully submits a new lead', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Promoter Submits a Business Lead')}

The newly onboarded promoter finds a business and submits their lead details to the platform for admin review.
`);

    const payload = {
      businessName: 'Awesome Tech Business',
      ownerName: 'John Doe',
      phone: '01711122233',
      email: 'johndoe_full@awesometech.com',
      address: '123 Tech Street, Silicon Valley',
    };

    const res = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send(payload);

    logApi(
      'POST',
      '/api/v1/leads',
      { body: payload },
      res.body,
      'LEAD-FULL-BDD-02-SUBMIT',
      'Promoter successfully submits a new lead'
    );

    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.success).toBe(true);

    const dbLead = await BusinessLead.findOne({ email: 'johndoe_full@awesometech.com' });
    expect(dbLead).not.toBeNull();
    expect(dbLead?.businessName).toBe('Awesome Tech Business');
  });

  it('Step 3: Admin retrieves all leads', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Admin Views Pending Leads')}

The platform admin opens the dashboard to view all newly submitted leads that require their review.
`);

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_leads_full@test.com',
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

    const res = await request(app)
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    logApi(
      'GET',
      '/api/v1/leads',
      {},
      res.body,
      'LEAD-FULL-BDD-03-ADMIN-GET-ALL',
      'Admin retrieves all leads'
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const lead = res.body.data.find((l: any) => l.email === 'johndoe_full@awesometech.com');
    expect(lead).toBeDefined();
    expect(lead.businessName).toBe('Awesome Tech Business');
  });

  it('Step 4: Admin updates lead status to IN_PROGRESS', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Admin Updates Lead Status to In Progress')}

The admin begins vetting the lead and updates the status to "IN_PROGRESS" so the promoter knows it's being worked on.
`);

    const lead = await BusinessLead.findOne({ email: 'johndoe_full@awesometech.com' });
    const payload = { status: 'IN_PROGRESS' };

    const adminToken = jwtHelper.createToken(
      {
        id: (await User.findOne({ email: 'admin_leads_full@test.com' }))?._id.toString() as string,
        userId: (await User.findOne({ email: 'admin_leads_full@test.com' }))?._id.toString() as string,
        role: USER_ROLES.ADMIN,
        email: 'admin_leads_full@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );

    const res = await request(app)
      .patch(`/api/v1/leads/${lead?._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    logApi(
      'PATCH',
      `/api/v1/leads/${lead?._id}/status`,
      { body: payload },
      res.body,
      'LEAD-FULL-BDD-04-ADMIN-UPDATE-STATUS',
      'Admin updates lead status to IN_PROGRESS'
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('Step 5: Promoter retrieves their own leads', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Promoter Checks Their Lead Status')}

The promoter checks their own dashboard to see the latest status of the leads they have submitted.
`);

    const res = await request(app)
      .get('/api/v1/leads/my-leads')
      .set('Authorization', `Bearer ${promoterToken}`);

    logApi(
      'GET',
      '/api/v1/leads/my-leads',
      {},
      res.body,
      'LEAD-FULL-BDD-05-PROMOTER-GET-MY-LEADS',
      'Promoter retrieves their own leads'
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].status).toBe('IN_PROGRESS');
  });

  it('Step 6: Admin updates lead status to REJECTED with note', async () => {
    console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('Admin Rejects Lead with Feedback')}

After vetting, the admin finds the lead invalid (e.g., fake number) and rejects it with an internal admin note and a rejection reason for the promoter.
`);

    const lead = await BusinessLead.findOne({ email: 'johndoe_full@awesometech.com' });
    const payload = { 
      status: 'REJECTED', 
      adminNote: 'Called them, fake number', 
      rejectReason: 'Fake phone number' 
    };

    const adminToken = jwtHelper.createToken(
      {
        id: (await User.findOne({ email: 'admin_leads_full@test.com' }))?._id.toString() as string,
        userId: (await User.findOne({ email: 'admin_leads_full@test.com' }))?._id.toString() as string,
        role: USER_ROLES.ADMIN,
        email: 'admin_leads_full@test.com',
      },
      config.jwt.jwt_secret as string,
      '1h',
    );

    const res = await request(app)
      .patch(`/api/v1/leads/${lead?._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    logApi(
      'PATCH',
      `/api/v1/leads/${lead?._id}/status`,
      { body: payload },
      res.body,
      'LEAD-FULL-BDD-06-ADMIN-REJECT-LEAD',
      'Admin updates lead status to REJECTED with note'
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectReason).toBe('Fake phone number');
  });
});
