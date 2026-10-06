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
import { User } from '../user.model';
import { USER_ROLES, , ACCOUNT_STATE, APP_STATE } from '../../../../enums/user';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { StatusCodes } from 'http-status-codes';
import {
  logApi,
  saveBddReport,
  bddReporter,
} from '../../../../helpers/__tests__/testLogger';
import { emailHelper } from '../../../../helpers/emailHelper';

chalk.level = 3;

vi.setConfig({ testTimeout: 30000 });

vi.spyOn(emailHelper, 'sendEmail').mockResolvedValue(undefined as any);

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
let regularUserToken: string;
let regularUserId: string;
let suspendedUserToken: string;
let suspendedUserId: string;

const assertErrorResponse = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  role: string,
  
  email: string,
  overrides: Record<string, any> = {},
) => {
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
    name: `${role} User`,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    isOnboard: true,
    ...overrides,
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

  const uData = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'security-user@test.com',
  );
  regularUserToken = uData.token;
  regularUserId = uData.userId;

  const sData = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'suspended-user@test.com',
    { accountState: ACCOUNT_STATE.SUSPENDED, blockReason: 'Policy violation' },
  );
  suspendedUserToken = sData.token;
  suspendedUserId = sData.userId;
});

afterAll(async () => {
  saveBddReport('reports/user-error-security-e2e-report.html');
  await mongoose.disconnect();
  await replSet.stop();
});

describe('User Module E2E Tests - Errors, Validation & Security', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTH & RBAC ERRORS (401 / 403)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 AUTH & RBAC: Authorization Security & Role Perimeter Defense', () => {
    it('BDD-01-A unauthenticated request to /profile returns 401 Unauthorized', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Security Guard
I want to deny unauthenticated access to personal profiles and member records
So that unauthorized visitors cannot inspect or manipulate private member data

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/profile')}
${bdd.label('• Access Policy:')} ${bdd.access('Requires valid JWT Bearer token in Authorization header')}
${bdd.label('• Expected Error:')} HTTP 401 Unauthorized

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Unauthenticated Access Defense')}
Feature: Authentication Perimeter

${bdd.keyword('Given')} an anonymous caller without Authorization headers
${bdd.keyword('When')} I GET /api/v1/user/profile
${bdd.keyword('Then')} I receive HTTP 401 Unauthorized with success: false
`);

      const response = await request(app)
        .get('/api/v1/user/profile')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/user/profile',
        {},
        response.body,
        'BDD-01-UNAUTHENTICATED-PROFILE',
        'Reject unauthenticated access to user profile',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-B non-admin user cannot access admin list endpoint /api/v1/user (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Security Boundary Enforcer
I want to prevent regular chauffeurs or users from accessing the administrative user directory
So that platform-wide member data and subscription financials remain protected

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user')}
${bdd.label('• Access Policy:')} ${bdd.access('Strictly restricted to USER_ROLES.ADMIN')}
${bdd.label('• Expected Error:')} HTTP 403 Forbidden

${bdd.scenario('📖 BDD SCENARIO: Stage 1.2 — Role-Based Access Control on User Directory')}
Feature: RBAC Enforcement

${bdd.keyword('Given')} an authenticated user with role: 'USER'
${bdd.keyword('When')} I GET /api/v1/user (Admin Directory)
${bdd.keyword('Then')} I receive HTTP 403 Forbidden
`);

      const response = await request(app)
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'GET',
        '/api/v1/user',
        {},
        response.body,
        'BDD-01-NON-ADMIN-LIST-USERS',
        'Deny non-admin user access to administrative user listing',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-C non-admin user cannot approve accounts (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Governance Enforcer
I want to block regular members from approving chauffeur onboarding applications
So that unauthorized drivers cannot self-activate without administrative vetting

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/approve')}
${bdd.label('• Access Policy:')} ${bdd.access('Strictly restricted to USER_ROLES.ADMIN')}
${bdd.label('• Expected Error:')} HTTP 403 Forbidden
`);

      const response = await request(app)
        .patch(`/api/v1/user/${regularUserId}/approve`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/approve',
        { params: { userId: regularUserId } },
        response.body,
        'BDD-01-NON-ADMIN-APPROVE',
        'Deny non-admin user attempt to approve accounts',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-D non-admin user cannot reject accounts (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Governance Enforcer
I want to block regular members from rejecting chauffeur onboarding applications
So that application rejections remain restricted to authorized platform administrators

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/reject')}
${bdd.label('• Access Policy:')} ${bdd.access('Strictly restricted to USER_ROLES.ADMIN')}
${bdd.label('• Expected Error:')} HTTP 403 Forbidden
`);

      const response = await request(app)
        .patch(`/api/v1/user/${regularUserId}/reject`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Unauthorized rejection attempt' })
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/reject',
        { params: { userId: regularUserId } },
        response.body,
        'BDD-01-NON-ADMIN-REJECT',
        'Deny non-admin user attempt to reject accounts',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-E non-admin user cannot block accounts (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Governance Enforcer
I want to block regular members from executing disciplinary account suspensions
So that account bans can only be decreed by authorized platform administrators

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/suspend')}
${bdd.label('• Access Policy:')} ${bdd.access('Strictly restricted to USER_ROLES.ADMIN')}
${bdd.label('• Expected Error:')} HTTP 403 Forbidden
`);

      const response = await request(app)
        .patch(`/api/v1/user/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Malicious attempt' })
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/suspend',
        { params: { userId: regularUserId } },
        response.body,
        'BDD-01-NON-ADMIN-SUSPEND',
        'Deny non-admin user attempt to suspend accounts',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-D non-admin cannot delete another user account (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Governance Enforcer,
I want to prevent regular users from calling administrative user deletion endpoints,
So that accounts can only be terminated by authorized platform administrators

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/user/:userId')}
${bdd.label('• Access Policy:')} ${bdd.access('Strictly restricted to USER_ROLES.ADMIN')}
${bdd.label('• Expected Error:')} HTTP 403 Forbidden
`);

      const response = await request(app)
        .delete(`/api/v1/user/${regularUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'DELETE',
        '/api/v1/user/:userId',
        { params: { userId: regularUserId } },
        response.body,
        'BDD-01-NON-ADMIN-DELETE-USER',
        'Deny non-admin user attempt to delete accounts',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-M unauthenticated request attempting to GET /api/v1/users/stats is rejected (401 Unauthorized)', async () => {
      const response = await request(app)
        .get('/api/v1/users/stats')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/users/stats',
        {},
        response.body,
        'BDD-01-M-UNAUTH-USER-STATS',
        'Reject unauthenticated access to user platform stats',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-N standard USER attempting to GET /api/v1/users/stats is forbidden (403 Forbidden)', async () => {
      const response = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'GET',
        '/api/v1/users/stats',
        {},
        response.body,
        'BDD-01-N-FORBIDDEN-USER-STATS',
        'Reject standard user access to user platform stats',
      );

      assertErrorResponse(response.body);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VALIDATION ERRORS (400 Bad Request)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 VALIDATION & SCHEMA INTEGRITY (Bad Request Defense)', () => {
    it('BDD-02-A rejects invalid phone format on profile update (400 Bad Request)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Integrity Guard
I want to validate incoming profile payload structures with strict Zod constraints
So that corrupted or malformed phone numbers cannot be persisted to user records

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/profile')}
${bdd.label('• Validation Rule:')} Phone numbers must adhere to standard international formats (7-15 digits with optional leading '+').
${bdd.label('• Expected Error:')} HTTP 400 Bad Request (Zod Validation Error)

${bdd.scenario('📖 BDD SCENARIO: Stage 2.1 — Schema Validation on Contact Information')}
Feature: Input Validation Guardrails

${bdd.keyword('Given')} an authenticated user with an invalid phone format payload
${bdd.keyword('When')} I PATCH /api/v1/user/profile with phone: 'not-a-valid-phone'
${bdd.keyword('Then')} I receive HTTP 400 Bad Request
`);

      const payload = { phone: 'not-a-valid-phone' };

      const response = await request(app)
        .patch('/api/v1/user/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'PATCH',
        '/api/v1/user/profile',
        { body: payload },
        response.body,
        'BDD-02-INVALID-PHONE',
        'Reject invalid phone number format',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-02-C rejects delete account when incorrect password is provided (400 Bad Request)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Account Security Guard
I want to require exact password confirmation before executing irreversible account deletion
So that malicious sessions or hijacked tokens cannot delete member accounts

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/user/delete-account')}
${bdd.label('• Verification Logic:')} Checks bcrypt hash against database password.
${bdd.label('• Expected Error:')} HTTP 400 Bad Request ("Password not match")

${bdd.scenario('📖 BDD SCENARIO: Stage 2.3 — Password Confirmation Defense on Deletion')}
Feature: Account Lifecycle Security

${bdd.keyword('Given')} an account deletion request with incorrect password
${bdd.keyword('When')} I DELETE /api/v1/user/delete-account
${bdd.keyword('Then')} I receive HTTP 400 Bad Request
`);

      const payload = { password: 'WrongPassword999!' };

      const response = await request(app)
        .delete('/api/v1/user/delete-account')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'DELETE',
        '/api/v1/user/delete-account',
        { body: payload },
        response.body,
        'BDD-02-WRONG-PASSWORD-DELETE',
        'Reject account deletion when password does not match',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Password not match');
    });

    it('BDD-02-D rejects malformed ObjectId path parameter in user details lookup (400 Bad Request)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Database Protection Guard
I want to validate path parameters against MongoDB ObjectId hex patterns
So that malformed database queries and injection attempts are rejected early at routing layer

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/:userId')}
${bdd.label('• Validation Rule:')} :userId must be a 24-character hexadecimal MongoDB ObjectId.
${bdd.label('• Expected Error:')} HTTP 400 Bad Request
`);

      const response = await request(app)
        .get('/api/v1/user/not-a-valid-mongodb-id')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'GET',
        '/api/v1/user/:userId',
        { params: { userId: 'not-a-valid-mongodb-id' } },
        response.body,
        'BDD-02-INVALID-OBJECTID',
        'Reject malformed MongoDB ObjectId',
      );

      assertErrorResponse(response.body);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. FAVORITES BUSINESS LOGIC & INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 FAVORITES BUSINESS LOGIC (Self-Favorite & Suspended Isolation)', () => {
    it('BDD-03-A user cannot add self to favorite chauffeurs list (400 Bad Request)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Business Logic Enforcer
I want to prevent users from bookmarking themselves in their own favorites roster
So that artificial self-promotion and circular favorites are prohibited

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/user/favorites/:chauffeurId')}
${bdd.label('• Conflict Rule:')} callerId === chauffeurId triggers 400 Bad Request.
${bdd.label('• Expected Error:')} HTTP 400 Bad Request ("You cannot add yourself to favorites")

${bdd.scenario('📖 BDD SCENARIO: Stage 3.1 — Prevent Self-Favoriting')}
Feature: Favorite Network Integrity

${bdd.keyword('Given')} an authenticated user
${bdd.keyword('When')} I POST /api/v1/user/favorites/:chauffeurId with my own user ID
${bdd.keyword('Then')} I receive HTTP 400 Bad Request with an anti-self-favoriting error message
`);

      const response = await request(app)
        .post(`/api/v1/user/favorites/${regularUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/user/favorites/:chauffeurId',
        { params: { chauffeurId: regularUserId } },
        response.body,
        'BDD-03-SELF-FAVORITE-FORBIDDEN',
        'Reject attempt by user to add self to favorites',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('cannot add yourself');
    });

    it('BDD-03-B cannot add suspended chauffeur to favorites list (400 Bad Request)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Compliance & Trust Enforcer
I want to block users from bookmarking suspended chauffeurs
So that penalized or suspended drivers cannot be added to private dispatch lists

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/user/favorites/:chauffeurId')}
${bdd.label('• Guardrail:')} Target account must not have accountState: 'SUSPENDED'.
${bdd.label('• Expected Error:')} HTTP 400 Bad Request ("Cannot add a suspended chauffeur")

${bdd.scenario('📖 BDD SCENARIO: Stage 3.2 — Suspended Chauffeur Favoriting Defense')}
Feature: Favorite Network Integrity

${bdd.keyword('Given')} a suspended chauffeur on the platform
${bdd.keyword('When')} I POST /api/v1/user/favorites/:chauffeurId with their ID
${bdd.keyword('Then')} I receive HTTP 400 Bad Request
`);

      const response = await request(app)
        .post(`/api/v1/user/favorites/${suspendedUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/user/favorites/:chauffeurId',
        { params: { chauffeurId: suspendedUserId } },
        response.body,
        'BDD-03-SUSPENDED-FAVORITE-FORBIDDEN',
        'Reject adding suspended chauffeur to favorites',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Cannot add a suspended chauffeur');
    });

    it('BDD-03-C adding non-existent chauffeur returns 404 Not Found', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Integrity Guard
I want to ensure target chauffeur existence before bookmarking
So that orphaned references are not stored in user documents

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/user/favorites/:chauffeurId')}
${bdd.label('• Expected Error:')} HTTP 404 Not Found ("Chauffeur not found")
`);

      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/api/v1/user/favorites/${nonExistentId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'POST',
        '/api/v1/user/favorites/:chauffeurId',
        { params: { chauffeurId: nonExistentId } },
        response.body,
        'BDD-03-FAVORITE-NOT-FOUND',
        'Return 404 for non-existent target chauffeur ID',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Chauffeur not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. NOT FOUND & STATE INTEGRITY DEFENSE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-04 NOT FOUND & WORKFLOW INTEGRITY', () => {
    it('BDD-04-A lookup for non-existent user returns 404 Not Found (GET /:userId)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Integrity Guard
I want to return 404 Not Found when a non-existent user profile is requested
So that clients receive clear feedback when resources do not exist

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/:userId')}
${bdd.label('• Expected Error:')} HTTP 404 Not Found ("User doesn't exist")

${bdd.scenario('📖 BDD SCENARIO: Stage 4.1 — Resource Existence Check')}
Feature: Resource Boundary Enforcement

${bdd.keyword('Given')} a non-existent user ObjectId
${bdd.keyword('When')} I GET /api/v1/user/:userId
${bdd.keyword('Then')} I receive HTTP 404 Not Found
`);

      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/v1/user/${nonExistentId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'GET',
        '/api/v1/user/:userId',
        { params: { userId: nonExistentId } },
        response.body,
        'BDD-04-USER-NOT-FOUND',
        'Return 404 for non-existent user ID',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain("User doesn't exist");
    });
  });
});
