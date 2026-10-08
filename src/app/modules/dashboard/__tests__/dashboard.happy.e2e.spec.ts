import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Campaign } from '../../campaign/campaign.model';
import { Post } from '../../post/post.model';
import { BusinessLead } from '../../lead/lead.model';
import { Subscription } from '../../subscription/subscription.model';
import {
  USER_ROLES,
  APP_STATE,
  ACCOUNT_STATE,
} from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import {
  logApi,
  saveBddReport,
  bddReporter,
} from '../../../../helpers/__tests__/testLogger';
import { CAMPAIGN_STATUS } from '../../../../enums/campaign';

chalk.level = 3;

vi.setConfig({ testTimeout: 30000 });

const bdd = {
  header: (text: string) => chalk.bold.cyan(text),
  section: (text: string) => chalk.bold.yellow(text),
  label: (text: string) => chalk.bold.hex('#38BDF8')(text),
  method: (m: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT') => {
    switch (m) {
      case 'GET':
        return chalk.bold.green(m);
      case 'POST':
        return chalk.bold.yellow(m);
      case 'PATCH':
        return chalk.bold.magenta(m);
      case 'DELETE':
        return chalk.bold.red(m);
      default:
        return chalk.bold.blue(m);
    }
  },
  endpoint: (url: string) => chalk.bold.white(url),
  access: (role: string) => chalk.bold.hex('#F472B6')(role),
  keyword: (k: string) => chalk.bold.greenBright(k),
  scenario: (text: string) => chalk.bold.hex('#A855F7')(text),
  field: (name: string) => chalk.bold.hex('#F59E0B')(name),
};

let replSet: MongoMemoryReplSet;
let dashboardAccessToken: string;
let chauffeurId: string;

const assertSuccessResponse = (body: any) => {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  role: string,
  email: string,
  appState: APP_STATE = APP_STATE.ACTIVE,
  accountState: ACCOUNT_STATE = ACCOUNT_STATE.VERIFIED,
) => {
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
    name: `${role} User`,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    appState,
    accountState,
  });

  const token = jwtHelper.createToken(
    { id: userId, userId, role, email },
    config.jwt.jwt_secret as string,
    '1h',
  );
  return { userId, token };
};

beforeAll(async () => {
  const originalConsoleInfo = console.info;
  console.info = (...args: any[]) => {
    const text = args
      .map(a => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
    if (text.includes('USER STORY') || text.includes('BDD SCENARIO')) {
      bddReporter.parseAndSetBddDoc(undefined, undefined, text);
    }
    originalConsoleInfo(...args);
  };

  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  await Campaign.deleteMany({});
  await Post.deleteMany({});
  await BusinessLead.deleteMany({});
  await Subscription.deleteMany({});

  const dashboardData = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    'dashboard-main@test.com',
  );
  dashboardAccessToken = dashboardData.token;
});

afterAll(async () => {
  saveBddReport('reports/dashboard-happy-e2e-report.html');
  await mongoose.connection.close();
  await replSet.stop();
});

describe('Dashboard Module E2E Tests - Happy Paths & Business Workflows', () => {
  beforeEach(async () => {
    await Campaign.deleteMany({});
    await Post.deleteMany({});
    await BusinessLead.deleteMany({});
    await Subscription.deleteMany({});

    // Seed a standard user
    const chauffeur = await createTestUserAndToken(
      USER_ROLES.PROMOTER,
      `promoter-${Date.now()}@test.com`,
      APP_STATE.PENDING,
      ACCOUNT_STATE.UNVERIFIED,
    );
    chauffeurId = chauffeur.userId;
  });

  afterEach(async () => {
    await Campaign.deleteMany({});
    await Post.deleteMany({});
    await BusinessLead.deleteMany({});
    await Subscription.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD STATS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 DASHBOARD PLATFORM STATS', () => {
    it('BDD-01.1 dashboard retrieves overall platform summary metrics', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Dashboardistrator
I want to view platform-wide growth metrics across users, subscriptions, drivers, jobs, and marketplace items
So that I can monitor system adoption and business trajectory in real time

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/dashboard/stats')}
${bdd.label('• Access:')} ${bdd.access('ADMIN Role Only')}
${bdd.label('• Calculated Metrics:')}
  - ${bdd.field('users')}: Total registered users and month-over-month growth rate.
  - ${bdd.field('activeSubscriptions')}: Active subscriber count and growth rate.
  - ${bdd.field('activeCampaigns')}: Active campaigns count.
  - ${bdd.field('activePosts')}: Active posts count.
  - ${bdd.field('totalLeads')}: Total active leads.

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Retrieve Platform Summary')}
${bdd.keyword('Given')} an authenticated dashboardistrator
${bdd.keyword('When')} I GET /api/v1/dashboard/stats
${bdd.keyword('Then')} I receive HTTP 200 OK with formatted growth statistics
`);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/dashboard/stats',
        {},
        response.body,
        response.status,
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('activeCampaigns');
      expect(response.body.data).toHaveProperty('activePosts');
      expect(response.body.data).toHaveProperty('totalLeads');
      expect(response.body.data.users).toHaveProperty('count');
      expect(response.body.data.users).toHaveProperty('growth');
      expect(response.body.data.users).toHaveProperty('growthType');
    });

    it('BDD-01.2 dashboard retrieves monthly time trends for jobs and items', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Dashboardistrator
I want to view monthly time trends
So that I can visualize growth patterns and seasonal platform activity

${bdd.scenario('Stage 1.2 — Retrieve Monthly Time Trends (With Query Filters)')}
${bdd.label('Feature:')} Executive Analytics — Time-Series Trend Analysis

${bdd.keyword('Given')} an authenticated platform dashboardistrator
${bdd.keyword('When')} I GET /api/v1/dashboard/monthly-trends
${bdd.keyword('Then')} I receive HTTP 200 OK with monthly trend arrays
`);

      const response = await request(app)
        .get('/api/v1/dashboard/monthly-trends')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/dashboard/monthly-trends',
        {},
        response.body,
        'BDD-01-B-MONTHLY-TRENDS',
        'Dashboard retrieves monthly time trends',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveProperty('campaignTrends');
      expect(response.body.data).toHaveProperty('postTrends');
      expect(Array.isArray(response.body.data.campaignTrends)).toBe(true);
      expect(Array.isArray(response.body.data.postTrends)).toBe(true);
      expect(response.body.data.campaignTrends.length).toBe(12);
    });

    it('BDD-01.3 dashboard retrieves recent platform activities limited to 5 latest items', async () => {
      console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('View the latest 5 platform activities')}

The admin can view the 5 most recent platform activities in the **Recent Activities** section of the dashboard.
`);

      await Campaign.create({
        businessId: new mongoose.Types.ObjectId(chauffeurId),
        title: 'New Launch',
        reward: '100',
        offer: 'Offer details',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: CAMPAIGN_STATUS.ACTIVE,
      });

      await Post.create({
        author: new mongoose.Types.ObjectId(chauffeurId),
        content: 'Check out this new campaign!',
      });

      const response = await request(app)
        .get('/api/v1/dashboard/recent-activities?limit=5')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/dashboard/recent-activities',
        { query: { limit: 5 } },
        response.body,
        'BDD-01-C-RECENT-ACTIVITIES',
        'Dashboard retrieves 5 most recent platform activities',
      );

      assertSuccessResponse(response.body);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('BDD-01.4 dashboard retrieves top businesses and top promoters', async () => {
      console.info(`
${bdd.header('📝 USER JOURNEY')}

${bdd.section('View Top Businesses and Top Promoters')}

The admin can view the top-performing businesses and promoters to identify the best performers on the platform.
`);

      // Seed 5 Business Owners
      for (let i = 0; i < 5; i++) {
        await User.create({
          name: `BUSINESS User ${i}`,
          email: `business-test-${Date.now()}-${i}@test.com`,
          password: 'Password123!',
          role: USER_ROLES.BUSINESS_OWNER,
          profilePicture: 'https://i.ibb.co/z5YHLV9/profile.png',
          phone: `123456789${i}`,
          businessName: `Test Business ${i}`,
        });
      }

      // Ensure we have at least 5 Promoters
      for (let i = 0; i < 2; i++) {
        await User.create({
          name: `PROMOTER User Extra ${i}`,
          email: `promoter-test-${Date.now()}-${i}@test.com`,
          password: 'Password123!',
          role: USER_ROLES.PROMOTER,
          profilePicture: 'https://i.ibb.co/z5YHLV9/profile.png',
          phone: `098765432${i}`,
        });
      }

      const response = await request(app)
        .get('/api/v1/dashboard/top-performers?role=PROMOTER')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/dashboard/top-performers',
        { query: { role: 'PROMOTER' } },
        response.body,
        'BDD-01-D-TOP-PERFORMERS',
        'Dashboard retrieves top promoters with role filter',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).not.toHaveProperty('topBusinesses');
      expect(response.body.data).toHaveProperty('topPromoters');

      const responseBusiness = await request(app)
        .get('/api/v1/dashboard/top-performers?role=BUSINESS_OWNER')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/dashboard/top-performers',
        { query: { role: 'BUSINESS_OWNER' } },
        responseBusiness.body,
        'BDD-01-D-TOP-BUSINESSES',
        'Dashboard retrieves top businesses with role filter',
      );

      assertSuccessResponse(responseBusiness.body);
      expect(responseBusiness.body.data).toHaveProperty('topBusinesses');
      expect(responseBusiness.body.data).not.toHaveProperty('topPromoters');
    });

    it('should respect limits and default to 5 for top performers (Edge Case)', async () => {
      // Seed 7 extra promoters for the limit test
      for (let i = 0; i < 7; i++) {
        await User.create({
          name: `PROMOTER Limit Test ${i}`,
          email: `promoter-limit-${Date.now()}-${i}@test.com`,
          password: 'Password123!',
          role: USER_ROLES.PROMOTER,
          profilePicture: 'https://i.ibb.co/z5YHLV9/profile.png',
          phone: `111222333${i}`,
        });
      }

      // 1. Test Default Limit (should be 5)
      const defaultResponse = await request(app)
        .get('/api/v1/dashboard/top-performers?role=PROMOTER')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      assertSuccessResponse(defaultResponse.body);
      expect(defaultResponse.body.data.topPromoters.length).toBe(5);

      // 2. Test Custom Limit (should return all 7+ available up to limit)
      const customResponse = await request(app)
        .get('/api/v1/dashboard/top-performers?role=PROMOTER&limit=10')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.OK);

      assertSuccessResponse(customResponse.body);
      // We expect more than 5 here, since we just added 7 new ones
      expect(customResponse.body.data.topPromoters.length).toBeGreaterThan(5);
      expect(customResponse.body.data.topPromoters.length).toBeLessThanOrEqual(10);
    });
  });
});
