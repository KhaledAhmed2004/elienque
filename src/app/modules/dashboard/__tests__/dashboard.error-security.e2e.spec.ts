import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { User } from '../../user/user.model';
import {
  USER_ROLES,

  APP_STATE,
} from '../../../../enums/user';
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
let dashboardAccessToken: string;
let userAccessToken: string;

const assertErrorResponse = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  role: string,
  
  email: string,
) => {
  const newUserId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: newUserId,
    name: `${role} User`,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    
    accountState: 'VERIFIED',
    appState: APP_STATE.ACTIVE,
  });

  const token = jwtHelper.createToken(
    { id: newUserId, userId: newUserId, role, email },
    config.jwt.jwt_secret as string,
    '1h',
  );
  return { userId: newUserId, token };
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

  const dashboard = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    
    'dashboard-sec@test.com',
  );
  dashboardAccessToken = dashboard.token;

  const normalUser = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'user-sec@test.com',
  );
  userAccessToken = normalUser.token;
});

afterAll(async () => {
  saveBddReport('reports/dashboard-error-security-e2e-report.html');
  await mongoose.connection.close();
  await replSet.stop();
});

describe('Dashboard Module E2E Tests - Error Handling, Validation & Security', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION & RBAC SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-SEC-01 AUTHENTICATION & AUTHORIZATION GUARDS', () => {
    it('BDD-SEC-01.1 unauthenticated request to dashboard stats is rejected with 401', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Unauthenticated Client
I should be blocked when attempting to access dashboard endpoints
So that private business intelligence remains protected

${bdd.scenario('📖 BDD SCENARIO: Anonymous Access Rejection')}
${bdd.keyword('Given')} an unauthenticated request
${bdd.keyword('When')} I GET /api/v1/dashboard/stats without token
${bdd.keyword('Then')} I receive HTTP 401 Unauthorized
`);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi('GET', '/api/v1/dashboard/stats', {}, response.body, response.status);
      assertErrorResponse(response.body);
    });

    it('BDD-SEC-01.2 regular user role is blocked with 403 Forbidden from dashboard routes', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Standard Chauffeur User
I must not be able to execute dashboardistrative actions or review dashboard metrics
So that platform privilege boundaries are strictly enforced

${bdd.scenario('📖 BDD SCENARIO: Privilege Escalation Prevention')}
${bdd.keyword('Given')} an authenticated user with role USER
${bdd.keyword('When')} I GET /api/v1/dashboard/monthly-trends
${bdd.keyword('Then')} I receive HTTP 403 Forbidden
`);

      const response = await request(app)
        .get('/api/v1/dashboard/monthly-trends')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi('GET', '/api/v1/dashboard/monthly-trends', {}, response.body, response.status);
      assertErrorResponse(response.body);
    });

    it('BDD-SEC-01.3 regular user role is blocked with 403 Forbidden from recent-activities', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/recent-activities')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi('GET', '/api/v1/dashboard/recent-activities', {}, response.body, response.status);
      assertErrorResponse(response.body);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. QUERY PARAMETER VALIDATION & BOUNDARY GUARDS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-SEC-02 QUERY PARAMETER VALIDATION & BOUNDARY GUARDS', () => {
    it('BDD-SEC-02.1 invalid range parameter returns 400 Bad Request', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/monthly-trends?range=invalid_range')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi('GET', '/api/v1/dashboard/monthly-trends', { query: { range: 'invalid_range' } }, response.body, response.status);
      assertErrorResponse(response.body);
    });

    it('BDD-SEC-02.2 invalid metric parameter returns 400 Bad Request', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/monthly-trends?metric=invalid_metric')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi('GET', '/api/v1/dashboard/monthly-trends', { query: { metric: 'invalid_metric' } }, response.body, response.status);
      assertErrorResponse(response.body);
    });

    it('BDD-SEC-02.3 invalid year parameter returns 400 Bad Request', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/monthly-trends?year=invalid_year')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi('GET', '/api/v1/dashboard/monthly-trends', { query: { year: 'invalid_year' } }, response.body, response.status);
      assertErrorResponse(response.body);
    });

    it('BDD-SEC-02.4 invalid limit parameter (limit > 50) returns 400 Bad Request', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/recent-activities?limit=100')
        .set('Authorization', `Bearer ${dashboardAccessToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi('GET', '/api/v1/dashboard/recent-activities', { query: { limit: 100 } }, response.body, response.status);
      assertErrorResponse(response.body);
    });
  });
});
