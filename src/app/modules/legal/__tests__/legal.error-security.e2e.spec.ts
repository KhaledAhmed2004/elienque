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
import { LegalPage } from '../legal.model';
import { ILegalPage } from '../legal.interface';
import { User } from '../../user/user.model';
import { USER_ROLES } from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import { logApi } from '../../../../helpers/__tests__/testLogger';

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
let userAccessToken: string;

const assertErrorResponse = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  role: string,
  
  email: string,
) => {
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
    name: `${role} User`,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    
    accountState: 'VERIFIED',
  });

  const token = jwtHelper.createToken(
    { id: userId, userId, role, email },
    config.jwt.jwt_secret as string,
    '1h',
  );
  return { userId, token };
};

const createLegalPageFixture = async (
  overrides: Partial<ILegalPage> = {},
) => {
  return LegalPage.create({
    title: `Legal Document ${new mongoose.Types.ObjectId()}`,
    content: '<p>Sample terms content...</p>',
    ...overrides,
  });
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  await LegalPage.deleteMany({});

  const adminData = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    
    'admin-legal-err@test.com',
  );
  adminAccessToken = adminData.token;

  const userData = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'user-legal-err@test.com',
  );
  userAccessToken = userData.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Legal Module E2E Tests - Errors, Validation & Security', () => {
  beforeEach(async () => {
    await LegalPage.deleteMany({});
  });

  afterEach(async () => {
    await LegalPage.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTH & RBAC ERRORS (401 / 403)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 AUTH & RBAC: Authorization Security & Administrative Protection', () => {
    it('BDD-01-A unauthenticated request cannot create legal page (401 Unauthorized)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Security Guard
I want to reject unauthenticated requests attempting to create legal documents
So that platform policies cannot be modified by anonymous actors

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/legals')}
${bdd.label('• Access Policy:')} ${bdd.access('ADMIN Only')}
${bdd.label('• Expected Response:')} 401 Unauthorized
`);

      const response = await request(app)
        .post('/api/v1/legals')
        .send({ title: 'Unauthorized Legal Page', content: 'Some content' })
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'POST',
        '/api/v1/legals',
        { body: { title: 'Unauthorized Legal Page' } },
        response.body,
        'BDD-01-A-UNAUTH-CREATE',
        'Unauthenticated create rejected with 401',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-B regular non-admin user cannot create legal page (403 Forbidden)', async () => {
      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ title: 'Chauffeur Legal Page', content: 'Some content' })
        .expect(StatusCodes.FORBIDDEN);

      assertErrorResponse(response.body);
    });

    it('BDD-01-C unauthenticated request cannot update legal page (401 Unauthorized)', async () => {
      const legalPage = await createLegalPageFixture({ title: 'Terms' });

      const response = await request(app)
        .patch(`/api/v1/legals/${legalPage._id}`)
        .send({ title: 'Tampered Terms' })
        .expect(StatusCodes.UNAUTHORIZED);

      assertErrorResponse(response.body);
    });

    it('BDD-01-D regular non-admin user cannot update legal page (403 Forbidden)', async () => {
      const legalPage = await createLegalPageFixture({ title: 'Terms' });

      const response = await request(app)
        .patch(`/api/v1/legals/${legalPage._id}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ title: 'Tampered Terms' })
        .expect(StatusCodes.FORBIDDEN);

      assertErrorResponse(response.body);
    });

    it('BDD-01-E unauthenticated request cannot delete legal page (401 Unauthorized)', async () => {
      const legalPage = await createLegalPageFixture({ title: 'Terms' });

      const response = await request(app)
        .delete(`/api/v1/legals/${legalPage._id}`)
        .expect(StatusCodes.UNAUTHORIZED);

      assertErrorResponse(response.body);
    });

    it('BDD-01-F regular non-admin user cannot delete legal page (403 Forbidden)', async () => {
      const legalPage = await createLegalPageFixture({ title: 'Terms' });

      const response = await request(app)
        .delete(`/api/v1/legals/${legalPage._id}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(StatusCodes.FORBIDDEN);

      assertErrorResponse(response.body);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VALIDATION ERRORS (400 Bad Request)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 VALIDATION: Payload Field Requirements & Boundary Checks', () => {
    it('BDD-02-A creating legal page without title returns 400 Bad Request', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an API Validation Middleware
I want to reject create requests lacking a title
So that invalid or empty documents are never persisted

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/legals')}
${bdd.label('• Expected Error:')} 400 Bad Request
`);

      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ content: 'Only content without title' })
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/legals',
        { body: { content: 'Only content without title' } },
        response.body,
        'BDD-02-A-MISSING-TITLE',
        'Create without title returns 400',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-02-B creating legal page with empty string title returns 400 Bad Request', async () => {
      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: '', content: 'Valid content' })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-C creating legal page with title exceeding 200 characters returns 400 Bad Request', async () => {
      const longTitle = 'A'.repeat(201);

      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: longTitle, content: 'Valid content' })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-D updating legal page with empty string title returns 400 Bad Request', async () => {
      const legalPage = await createLegalPageFixture({ title: 'Valid Initial Title' });

      const response = await request(app)
        .patch(`/api/v1/legals/${legalPage._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: '' })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-E requesting with malformed ObjectId returns 400 Bad Request', async () => {
      const response = await request(app)
        .get('/api/v1/legals/invalid-hex-id-123')
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-F creating legal page with content exceeding 100,000 characters returns 400 Bad Request', async () => {
      const hugeContent = 'X'.repeat(100001);

      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Huge Policy', content: hugeContent })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CONFLICT ERRORS: Unique Title Defense & Concurrency (409 Conflict)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 CONFLICT: Unique Title Collision & Concurrency Defense (409 Conflict)', () => {
    it('BDD-03-A creating a legal page with duplicate title returns 409 Conflict', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Integrity Guard
I want to prevent creating duplicate legal policy documents with identical titles
So that each legal policy is distinct and uniquely identifiable

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/legals')}
${bdd.label('• Expected Error:')} 409 Conflict
`);

      await createLegalPageFixture({ title: 'Terms of Service' });

      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Terms of Service', content: 'Another version' })
        .expect(StatusCodes.CONFLICT);

      logApi(
        'POST',
        '/api/v1/legals',
        { body: { title: 'Terms of Service' } },
        response.body,
        'BDD-03-A-DUPLICATE-CREATE',
        'Duplicate title create rejected with 409 Conflict',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-03-B updating a legal page title to match another existing page returns 409 Conflict', async () => {
      const page1 = await createLegalPageFixture({ title: 'Terms of Service' });
      const page2 = await createLegalPageFixture({ title: 'Privacy Policy' });

      const response = await request(app)
        .patch(`/api/v1/legals/${page2._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Terms of Service' })
        .expect(StatusCodes.CONFLICT);

      logApi(
        'PATCH',
        `/api/v1/legals/${page2._id}`,
        { params: { legalId: page2._id.toString() }, body: { title: 'Terms of Service' } },
        response.body,
        'BDD-03-B-DUPLICATE-UPDATE',
        'Duplicate title update rejected with 409 Conflict',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-03-C case-insensitive duplicate title returns 409 Conflict', async () => {
      await createLegalPageFixture({ title: 'Terms of Service' });

      const response = await request(app)
        .post('/api/v1/legals')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'terms of service', content: 'Lowercase version' })
        .expect(StatusCodes.CONFLICT);

      assertErrorResponse(response.body);
    });

    it('BDD-03-D concurrent parallel create requests with same title produce exactly one 201 and one 409', async () => {
      const payload = {
        title: 'Concurrent Race Terms',
        content: '<p>Testing atomic concurrency uniqueness</p>',
      };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/legals')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send(payload),
        request(app)
          .post('/api/v1/legals')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send(payload),
      ]);

      const statusCodes = [res1.status, res2.status].sort();
      expect(statusCodes).toEqual([StatusCodes.CREATED, StatusCodes.CONFLICT]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. NOT FOUND ERRORS (404 Not Found)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-04 NOT FOUND: Non-Existent Entity Lookups & Mutations (404 Not Found)', () => {
    it('BDD-04-A retrieving non-existent legal page returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/v1/legals/${nonExistentId}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'GET',
        `/api/v1/legals/${nonExistentId}`,
        { params: { legalId: nonExistentId } },
        response.body,
        'BDD-04-A-NOT-FOUND-GET',
        'Get non-existent legal page returns 404',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-04-B updating non-existent legal page returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/api/v1/legals/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Updated NonExistent' })
        .expect(StatusCodes.NOT_FOUND);

      assertErrorResponse(response.body);
    });

    it('BDD-04-C deleting non-existent legal page returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/v1/legals/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.NOT_FOUND);

      assertErrorResponse(response.body);
    });
  });
});

