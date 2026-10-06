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
import { Vehicle } from '../../vehicle/vehicle.model';
import { Job } from '../../job/job.model';
import { Item } from '../../item/item.model';
import { Deal } from '../../deal/deal.model';
import { Subscription } from '../../subscription/subscription.model';
import {
  USER_ROLES,

  APP_STATE,
  ACCOUNT_STATE,
  VEHICLE_STATUS,
} from '../../../../enums/user';
import {
  JOB_TYPE,
  PAYMENT_TYPE,
  DISPATCH_TYPE,
  JOB_STATUS,
} from '../../job/job.interface';
import { ITEM_STATUS } from '../../item/item.interface';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import {
  logApi,
  saveBddReport,
  bddReporter,
} from '../../../../helpers/__tests__/testLogger';

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
let adminAccessToken: string;
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
  await Vehicle.deleteMany({});
  await Job.deleteMany({});
  await Item.deleteMany({});
  await Deal.deleteMany({});
  await Subscription.deleteMany({});

  const adminData = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    
    'admin-main@test.com',
  );
  adminAccessToken = adminData.token;
});

afterAll(async () => {
  saveBddReport('reports/admin-happy-e2e-report.html');
  await mongoose.connection.close();
  await replSet.stop();
});

describe('Admin Module E2E Tests - Happy Paths & Business Workflows', () => {
  beforeEach(async () => {
    await Vehicle.deleteMany({});
    await Job.deleteMany({});
    await Item.deleteMany({});
    await Deal.deleteMany({});
    await Subscription.deleteMany({});

    // Seed a standard chauffeur for management testing
    const chauffeur = await createTestUserAndToken(
      USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
      
      `chauffeur-${Date.now()}@test.com`,
      APP_STATE.PENDING,
      ACCOUNT_STATE.UNVERIFIED,
    );
    chauffeurId = chauffeur.userId;

    // Seed a vehicle for the chauffeur
    await Vehicle.create({
      owner: new mongoose.Types.ObjectId(chauffeurId),
      type: 'Sedan',
      makeAndModel: 'Mercedes-Benz S-Class',
      colorInside: 'Black',
      colorOutside: 'Silver',
      year: 2023,
      licensePlate: 'VIP-777',
      licensePlateRaw: 'VIP777',
      status: VEHICLE_STATUS.PENDING_REVIEW,
      vehicleRegistration: {
        image: 'https://example.com/reg.jpg',
        expiryDate: new Date('2028-01-01'),
      },
      commercialInsurance: {
        image: 'https://example.com/ins.jpg',
        expiryDate: new Date('2028-01-01'),
      },
    });
  });

  afterEach(async () => {
    await Vehicle.deleteMany({});
    await Job.deleteMany({});
    await Item.deleteMany({});
    await Deal.deleteMany({});
    await Subscription.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD STATS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 DASHBOARD PLATFORM STATS', () => {
    it('BDD-01.1 admin retrieves overall platform summary metrics', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Administrator
I want to view platform-wide growth metrics across users, subscriptions, drivers, jobs, and marketplace items
So that I can monitor system adoption and business trajectory in real time

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/admin/stats')}
${bdd.label('• Access:')} ${bdd.access('ADMIN Role Only')}
${bdd.label('• Calculated Metrics:')}
  - ${bdd.field('users')}: Total registered users and month-over-month growth rate.
  - ${bdd.field('activeSubscriptions')}: Active subscriber count and growth rate.
  - ${bdd.field('pendingDrivers')}: Chauffeurs with pending review status.
  - ${bdd.field('activeJobs')}: Ongoing active rides and deliveries.
  - ${bdd.field('totalItems')}: Total active marketplace listings.

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Retrieve Platform Summary')}
${bdd.keyword('Given')} an authenticated administrator
${bdd.keyword('When')} I GET /api/v1/admin/stats
${bdd.keyword('Then')} I receive HTTP 200 OK with formatted growth statistics
`);

      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi('GET', '/api/v1/admin/stats', {}, response.body, response.status);

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('pendingDrivers');
      expect(response.body.data).toHaveProperty('activeJobs');
      expect(response.body.data).toHaveProperty('totalItems');
      expect(response.body.data.users).toHaveProperty('count');
      expect(response.body.data.users).toHaveProperty('growth');
      expect(response.body.data.users).toHaveProperty('growthType');
    });

    it('BDD-01.2 admin retrieves monthly time trends for jobs and items', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Administrator
I want to view monthly time trends for job completions and marketplace listings
So that I can visualize growth patterns and seasonal platform activity

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/admin/monthly-trends')}
${bdd.label('• Access:')} ${bdd.access('ADMIN Role Only')}
${bdd.label('• Query Parameters:')}
  - year:   (Optional, integer, e.g. ?year=2025). Filters time trends for a specific calendar year. Defaults to current year if omitted.
  - range:  (Optional, '3m' | '6m' | '12m' | 'this-year'). Slices time trends by months.
  - metric: (Optional, 'all' | 'jobs' | 'items'). Filters returned metric series. Defaults to 'all'.
${bdd.label('• Example URLs:')}
  - Default (Current Year):     GET /api/v1/admin/monthly-trends
  - Historical Year Filter:     GET /api/v1/admin/monthly-trends?year=2025
  - Last 3 Months:              GET /api/v1/admin/monthly-trends?range=3m
  - Last 6 Months (Jobs Only):  GET /api/v1/admin/monthly-trends?range=6m&metric=jobs
${bdd.label('• Response Structure:')}
  - { success: true, statusCode: 200, message: "Monthly trends retrieved successfully", data: { jobTrends: Array, itemTrends: Array } }

${bdd.scenario('Stage 1.2 — Retrieve Monthly Time Trends (With Query Filters)')}
${bdd.label('Feature:')} Executive Analytics — Time-Series Trend Analysis

${bdd.keyword('Given')} an authenticated platform administrator
${bdd.keyword('When')} I GET /api/v1/admin/monthly-trends
${bdd.keyword('Then')} I receive HTTP 200 OK with monthly trend arrays for jobs and items (default current year)
${bdd.keyword('When')} I GET /api/v1/admin/monthly-trends?year=2025
${bdd.keyword('Then')} I receive HTTP 200 OK with 12 monthly trend data points for the requested historical year
${bdd.keyword('When')} I GET /api/v1/admin/monthly-trends?range=3m
${bdd.keyword('Then')} I receive HTTP 200 OK with at most 3 monthly trend data points
${bdd.keyword('When')} I GET /api/v1/admin/monthly-trends?range=6m&metric=jobs
${bdd.keyword('Then')} I receive HTTP 200 OK with job trends only and empty item trends
`);

      const response = await request(app)
        .get('/api/v1/admin/monthly-trends')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/admin/monthly-trends',
        {},
        response.body,
        'BDD-01-B-MONTHLY-TRENDS',
        'Admin retrieves monthly time trends for jobs and items (default: current year)',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveProperty('jobTrends');
      expect(response.body.data).toHaveProperty('itemTrends');
      expect(Array.isArray(response.body.data.jobTrends)).toBe(true);
      expect(Array.isArray(response.body.data.itemTrends)).toBe(true);
      expect(response.body.data.jobTrends.length).toBe(12);

      // Verify explicit ?year= parameter support for historical analytics
      const yearResponse = await request(app)
        .get('/api/v1/admin/monthly-trends?year=2025')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/admin/monthly-trends',
        { query: { year: 2025 } },
        yearResponse.body,
        'BDD-01-B-MONTHLY-TRENDS-YEAR',
        'Admin retrieves historical monthly time trends by specifying year query parameter',
      );

      assertSuccessResponse(yearResponse.body);
      expect(yearResponse.body.data.jobTrends.length).toBe(12);
      expect(yearResponse.body.data.itemTrends.length).toBe(12);

      // Verify ?range=3m filter
      const rangeResponse = await request(app)
        .get('/api/v1/admin/monthly-trends?range=3m')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/admin/monthly-trends',
        { query: { range: '3m' } },
        rangeResponse.body,
        'BDD-01-B-MONTHLY-TRENDS-3M',
        'Admin retrieves last 3 months trend data',
      );

      assertSuccessResponse(rangeResponse.body);
      expect(rangeResponse.body.data.jobTrends.length).toBeLessThanOrEqual(3);
      expect(rangeResponse.body.data.itemTrends.length).toBeLessThanOrEqual(3);

      // Verify ?range=6m&metric=jobs filter
      const metricResponse = await request(app)
        .get('/api/v1/admin/monthly-trends?range=6m&metric=jobs')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/admin/monthly-trends',
        { query: { range: '6m', metric: 'jobs' } },
        metricResponse.body,
        'BDD-01-B-MONTHLY-TRENDS-6M-JOBS',
        'Admin retrieves last 6 months trend data for jobs only',
      );

      assertSuccessResponse(metricResponse.body);
      expect(metricResponse.body.data.jobTrends.length).toBeLessThanOrEqual(6);
      expect(metricResponse.body.data.itemTrends.length).toBe(0);
    });

    it('BDD-01.3 admin retrieves recent platform activities limited to 5 latest items', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Administrator
I want to view the latest 5 platform activities across registrations, driver applications, jobs, and listings
So that I have immediate real-time visibility into the platform's active pulse

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/admin/recent-activities?limit=5')}
${bdd.label('• Access:')} ${bdd.access('ADMIN Role Only')}
${bdd.label('• Result Set:')} Exactly top 5 chronological records (descending order)

${bdd.scenario('Stage 1.3 — Retrieve Recent Activities Feed')}
${bdd.label('Feature:')} Executive Pulse — Recent Activity Feeds

${bdd.keyword('Given')} an authenticated administrator and recent platform events
${bdd.keyword('When')} I GET /api/v1/admin/recent-activities
${bdd.keyword('Then')} I receive HTTP 200 OK with at most 5 recent activities sorted by timestamp descending
`);

      // Seed a job
      await Job.create({
        pickup: 'Beverly Hills 90210',
        dropoff: 'LAX Airport Terminal 4',
        jobType: JOB_TYPE.ONE_WAY,
        vehicleType: 'Sedan',
        paymentType: PAYMENT_TYPE.COLLECT_PAYMENT,
        paymentAmount: 150,
        dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
        status: JOB_STATUS.PENDING,
        createdBy: new mongoose.Types.ObjectId(chauffeurId),
      });

      // Seed a marketplace item
      await Item.create({
        title: 'Luxury S-Class Floor Mats',
        description: 'Brand new OEM custom fit',
        price: 120,
        location: 'Los Angeles, CA',
        status: ITEM_STATUS.AVAILABLE,
        createdBy: new mongoose.Types.ObjectId(chauffeurId),
        photos: ['https://example.com/item.jpg'],
      });

      const response = await request(app)
        .get('/api/v1/admin/recent-activities?limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/admin/recent-activities',
        { query: { limit: 5 } },
        response.body,
        'BDD-01-C-RECENT-ACTIVITIES',
        'Admin retrieves 5 most recent platform activities',
      );

      assertSuccessResponse(response.body);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify each activity structure
      const firstActivity = response.body.data[0];
      expect(firstActivity).toHaveProperty('id');
      expect(firstActivity).toHaveProperty('type');
      expect(firstActivity).toHaveProperty('title');
      expect(firstActivity).toHaveProperty('description');
      expect(firstActivity).toHaveProperty('timestamp');

      // Verify chronological descending order
      for (let i = 1; i < response.body.data.length; i++) {
        const prev = new Date(response.body.data[i - 1].timestamp).getTime();
        const curr = new Date(response.body.data[i].timestamp).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });
});

