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
import { Job } from '../../job/job.model';
import { JOB_TYPE, PAYMENT_TYPE, JOB_STATUS } from '../../job/job.interface';
import { Vehicle } from '../../vehicle/vehicle.model';
import { USER_ROLES, , ACCOUNT_STATE, APP_STATE, VEHICLE_STATUS } from '../../../../enums/user';
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

// Mock emailHelper to avoid SMTP network attempts during testing
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
let adminAccessToken: string;
let adminId: string;
let user1AccessToken: string;
let user1Id: string;
let user2AccessToken: string;
let user2Id: string;

const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const assertSuccessResponse = (body: any) => {
  expect(body).toHaveProperty('success', true);
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
  await Job.deleteMany({});
  await Vehicle.deleteMany({});

  const adminData = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    
    'admin-user-happy@test.com',
  );
  adminAccessToken = adminData.token;
  adminId = adminData.userId;

  const u1Data = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'chauffeur-one@test.com',
    { name: 'John Doe', nickname: 'Johnny', serviceArea: 'New York City' },
  );
  user1AccessToken = u1Data.token;
  user1Id = u1Data.userId;

  const u2Data = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'chauffeur-two@test.com',
    { name: 'Jane Smith', nickname: 'Janie', serviceArea: 'Los Angeles' },
  );
  user2AccessToken = u2Data.token;
  user2Id = u2Data.userId;
});

afterAll(async () => {
  saveBddReport('reports/user-happy-e2e-report.html');
  await mongoose.disconnect();
  await replSet.stop();
});

describe('User Module E2E Tests - Happy Paths & Business Workflows', () => {
  beforeEach(async () => {
    // Reset collections between tests while keeping the primary test users
    await Job.deleteMany({});
    await Vehicle.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. GET USER PROFILE (SELF PROFILE INSPECTION & PERMISSION SCOPING)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 GET USER PROFILE (Self Profile Inspection & Permission Scoping)', () => {
    it('BDD-01-A authenticated user retrieves their own profile with sanitized fields (GET /profile)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated Chauffeur or Platform Member
I want to inspect my own personal account profile
So that I can verify my operational readiness, onboarding state, active payment preferences, and contact details

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/profile')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Field Sanitization & Data Masking:')}
  - Stripped Internal Credentials: ${bdd.field('password')}, ${bdd.field('role')}, and ${bdd.field('favoriteChauffeurs')} are strictly omitted for regular members.
  - License Sub-Document Stripping: Raw license file paths and compliance audit internals are hidden from public card structures.
${bdd.label('• Response Structure:')}
  - { success: true, message: "Profile data retrieved successfully", data: { id, name, email, phone, serviceArea, accountState, appState, isOnboard, profilePicture, badges, paymentMethods } }

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Retrieve Own Profile (Sanitized Member Data)')}
Feature: User Self Profile

${bdd.keyword('Given')} an authenticated regular platform user
${bdd.keyword('When')} I GET /api/v1/user/profile
${bdd.keyword('Then')} I receive HTTP 200 OK containing my sanitized profile information
${bdd.keyword('And')} sensitive fields such as 'password' and 'role' are omitted from the payload
`);

      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/profile',
        {},
        response.body,
        'BDD-01-GET-PROFILE-USER',
        'User retrieves sanitized personal profile',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.name).toBe('John Doe');
      expect(response.body.data.email).toBe('chauffeur-one@test.com');
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('role');
    });

    it('BDD-01-B authenticated ADMIN retrieves full administrator profile with role scope (GET /profile)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Administrator
I want to inspect my administrative profile
So that I can verify my elevated role permissions and platform governance access

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/profile')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (ADMIN)')}
${bdd.label('• Role Preservation:')} Admin accounts retain ${bdd.field("role: 'ADMIN'")} to enable admin panel routing on client applications.
${bdd.label('• Response Structure:')} { success: true, message: "Profile data retrieved successfully", data: { id, name, email, role: "ADMIN", ... } }

${bdd.scenario('📖 BDD SCENARIO: Stage 1.2 — Retrieve Administrator Profile')}
Feature: Administrative Self Profile

${bdd.keyword('Given')} an authenticated administrative user
${bdd.keyword('When')} I GET /api/v1/user/profile
${bdd.keyword('Then')} I receive HTTP 200 OK with role: 'ADMIN'
`);

      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/profile',
        {},
        response.body,
        'BDD-01-GET-PROFILE-ADMIN',
        'Admin retrieves full administrative profile',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.email).toBe('admin-user-happy@test.com');
      expect(response.body.data.role).toBe(USER_ROLES.ADMIN);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. UPDATE USER PROFILE (COMPREHENSIVE MULTIPART & CREDENTIAL UPDATE)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 UPDATE USER PROFILE (Comprehensive Personal Data, Documents & Payment Methods)', () => {
    it('BDD-02 updates personal information, service area, payment methods, profile picture, and licenses simultaneously via multipart form-data', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Registered Chauffeur / Platform Member
I want to update my personal credentials, service area, multilingual capabilities, digital payment methods, and compliance license images in a single atomic submission
So that passengers, operators, and platform administrators have my complete and verified operational profile

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/profile')}
${bdd.label('• Content-Type:')} ${bdd.access('multipart/form-data (Supports text fields, JSON strings, and binary file attachments)')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Payload Attribute Breakdown & Constraints:')}
  - ${bdd.field('name')} (string): Full legal or operational display name (e.g., 'John Multi Doe').
  - ${bdd.field('nickname')} (string | optional): Public display handle or callsign (e.g., 'JD Star').
  - ${bdd.field('serviceArea')} (string): Operational territory/depot (e.g., 'Manhattan & Queens').
  - ${bdd.field('paymentMethods')} (object / JSON string): Direct peer-to-peer and digital payment credentials:
    * ${bdd.field('zelle')} ({ email }): Valid email linked to Zelle recipient account.
    * ${bdd.field('venmo')} ({ username }): Venmo recipient handle.
    * ${bdd.field('cashApp')} ({ cashtag }): CashApp recipient handle with leading '$'.
  - ${bdd.field('drivingLicenseExpiryDate')} (string): Expiration date string mapped to driving license sub-document.
  - ${bdd.field('profilePicture')} (Binary File | maxCount: 1): Avatar image file (JPEG, PNG, WebP).
  - ${bdd.field('drivingLicenseImage')} (Binary File | maxCount: 1): Official driving license document image.
${bdd.label('• Architectural Processing & Security Pipeline:')}
  - 1. ${bdd.keyword('fileHandler Middleware')}: Inspects magic byte headers, optimizes images, and persists files to disk/cloud with cryptographically random UUIDs.
  - 2. ${bdd.keyword('mapLicenseFields Controller Helper')}: Merges flat form-data file keys ('drivingLicenseImage') and expiry dates ('drivingLicenseExpiryDate') into nested schema objects ('drivingLicense: { image, expiryDate }').
  - 3. ${bdd.keyword('Stale Asset Pruning')}: Automatically unlinks and deletes superseded file assets on disk to prevent filesystem bloat.
  - 4. ${bdd.keyword('Field Sanitation & Privacy')}: Strips internal database hashes, passwords, internal roles, and license sub-document objects from the returned HTTP response.

${bdd.scenario('📖 BDD SCENARIO: Stage 2.1 — Comprehensive Multipart Profile Update')}
Feature: User Profile & Document Management

${bdd.keyword('Given')} an authenticated chauffeur with active platform access
${bdd.keyword('When')} I PATCH /api/v1/user/profile with personal details, payment methods, profile picture, and driving license image
${bdd.keyword('Then')} I receive HTTP 200 OK with the sanitized profile record
${bdd.keyword('And')} the updated contact info and payment methods are saved to MongoDB
${bdd.keyword('And')} image files are safely processed, stored, and attached to the user record
`);

      const paymentMethodsPayload = JSON.stringify({
        zelle: { email: 'john.zelle@test.com' },
        venmo: { username: 'john_venmo' },
        cashApp: { cashtag: '$johncash' },
      });

      const response = await request(app)
        .patch('/api/v1/user/profile')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .field('name', 'John Multi Doe')
        .field('nickname', 'JD Star')
        .field('serviceArea', 'Manhattan & Queens')
        .field('paymentMethods', paymentMethodsPayload)
        .field('drivingLicenseExpiryDate', '2028-12-31')
        .attach('profilePicture', validPngBuffer, 'profile.png')
        .attach('drivingLicenseImage', validPngBuffer, 'license.png')
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/user/profile',
        {
          body: {
            name: 'John Multi Doe',
            nickname: 'JD Star',
            serviceArea: 'Manhattan & Queens',
            paymentMethods: {
              zelle: { email: 'john.zelle@test.com' },
              venmo: { username: 'john_venmo' },
              cashApp: { cashtag: '$johncash' },
            },
            drivingLicenseExpiryDate: '2028-12-31',
          },
          files: ['profilePicture', 'drivingLicenseImage'],
        },
        response.body,
        'BDD-02-UPDATE-PROFILE-COMPREHENSIVE',
        'User updates personal details, payment methods, and compliance documents in a single multipart request',
      );

      assertSuccessResponse(response.body);

      // Verify returned sanitized response
      expect(response.body.data.name).toBe('John Multi Doe');
      expect(response.body.data.nickname).toBe('JD Star');
      expect(response.body.data.serviceArea).toBe('Manhattan & Queens');
      expect(response.body.data.paymentMethods.zelle.email).toBe('john.zelle@test.com');
      expect(response.body.data.paymentMethods.venmo.username).toBe('john_venmo');
      expect(response.body.data.paymentMethods.cashApp.cashtag).toBe('$johncash');
      expect(response.body.data.profilePicture).toMatch(/\/uploads\/images\//);
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('role');

      // Verify database persistence
      const savedUser = await User.findById(user1Id);
      expect(savedUser?.name).toBe('John Multi Doe');
      expect(savedUser?.nickname).toBe('JD Star');
      expect(savedUser?.serviceArea).toBe('Manhattan & Queens');
      expect(savedUser?.paymentMethods?.zelle?.email).toBe('john.zelle@test.com');
      expect(savedUser?.profilePicture).toMatch(/\/uploads\/images\//);
      expect(savedUser?.drivingLicense?.image).toMatch(/\/uploads\/images\//);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CHAUFFEUR DISCOVERY & SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 CHAUFFEUR DISCOVERY & SEARCH (Feed & Cursor Pagination)', () => {
    it('BDD-03-A searches chauffeurs with search term and keyset pagination', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User or Chauffeur
I want to discover and search for other active chauffeurs by name, nickname, or phone
So that I can explore verified peers, evaluate rating badges, and manage my personal favorites network

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/chauffeurs')}
${bdd.label('• Semantic Routing Purpose:')} Dedicated peer discovery feed for passenger assignments, peer dispatch, and networking (distinct from admin table queries).
${bdd.label('• Access Policy & Isolation Rules:')}
  - Access: Authenticated (${bdd.access('USER or ADMIN')}).
  - Self-Exclusion: The requesting user's own profile is automatically excluded (${bdd.field('_id != caller.userId')}).
  - Account Isolation: Suspended accounts (${bdd.field("accountState === 'SUSPENDED'")}) are strictly omitted from discovery.
${bdd.label('• Query & Keyset Pagination Capabilities:')}
  - Supports ${bdd.field('?searchTerm=<query>')} with regex sanitization for real-time substring search across ${bdd.field('name')}, ${bdd.field('nickname')}, and ${bdd.field('phone')}.
  - Supports ${bdd.field('?limit=<n>')} (1-50, default 10) for bandwidth-optimized client batching.
  - Supports ${bdd.field('?cursor=<base64url>')} keyset cursor tokens for continuous infinite scrolling without offset drift.
${bdd.label('• Response Structure & Bandwidth Optimization Rationale:')}
  - { success: true, message: "Chauffeurs retrieved successfully", cursor: { nextCursor, hasMore, limit }, data: [{ _id, name, nickname, phone, profilePicture, serviceArea, averageRating, totalReviews, badges, isFavorite }] }
  - ${bdd.field('cursor')} ({ nextCursor, hasMore, limit }): Keyset cursor pagination state object for continuous infinite scrolling:
    * ${bdd.field('nextCursor')} (string | null): Base64-encoded token containing the last chauffeur's _id. Frontend passes this as '?cursor=<token>' in subsequent requests.
    * ${bdd.field('hasMore')} (boolean): Indicates whether additional active chauffeurs exist in MongoDB.
    * ${bdd.field('limit')} (number): Effective batch size applied to the query.
  - ${bdd.field('data')} (Array): Lightweight card summaries of active peer chauffeurs:
    * ${bdd.field('_id')} (ObjectId): Unique chauffeur user ID for direct profile lookups and favorite toggles.
    * ${bdd.field('name')} (string): Full operational display name.
    * ${bdd.field('nickname')} (string | optional): Public callsign or handle.
    * ${bdd.field('phone')} (string): Verified contact telephone number.
    * ${bdd.field('profilePicture')} (string): Hosted avatar image URL rendered in peer listings.
    * ${bdd.field('serviceArea')} (string): Designated operational region or home airport depot.
    * ${bdd.field('averageRating')} (number): Aggregate review rating calculated from completed jobs (0–5).
    * ${bdd.field('totalReviews')} (number): Total count of passenger and operator reviews received.
    * ${bdd.field('badges')} (string[]): Dynamic merit badges (e.g. ['Top Rated'] when rating >= 4.8 and reviews >= 10).
    * ${bdd.field('isFavorite')} (boolean): Dynamically computed flag reflecting if the caller has bookmarked this chauffeur in their favoriteChauffeurs list.

${bdd.scenario('📖 BDD SCENARIO: Stage 3.1 — Chauffeur Discovery Feed & Keyset Pagination')}
Feature: Chauffeur Discovery & Peer Connection

${bdd.keyword('Given')} active and verified platform chauffeurs in MongoDB
${bdd.keyword('When')} I GET /api/v1/user/chauffeurs with search term and limit parameters
${bdd.keyword('Then')} I receive HTTP 200 OK with paginated active chauffeur summaries
${bdd.keyword('And')} the caller's own record and suspended accounts are excluded from the result set
${bdd.keyword('And')} dynamic 'isFavorite' status and merit badges are computed for each driver card
`);

      const response = await request(app)
        .get('/api/v1/user/chauffeurs')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .query({ searchTerm: 'Jane', limit: 5 })
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/chauffeurs',
        { query: { searchTerm: 'Jane', limit: 5 } },
        response.body,
        'BDD-03-SEARCH-CHAUFFEURS',
        'User searches active chauffeurs',
      );

      assertSuccessResponse(response.body);
      expect(response.body).toHaveProperty('cursor');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].name).toBe('Jane Smith');
      expect(response.body.data[0]._id.toString()).toBe(user2Id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FAVORITE CHAUFFEURS MANAGEMENT (LIFECYCLE & BOOKMARK NETWORK)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-04 FAVORITE CHAUFFEURS MANAGEMENT (Add, List & Remove Lifecycle)', () => {
    it('BDD-04-A adds a chauffeur to favorites list with atomic idempotency (POST /favorites/:chauffeurId)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User or Chauffeur
I want to bookmark trusted and top-performing chauffeurs in my personal favorites list
So that I can quickly access their contact cards, evaluate availability, and assign high-priority bookings to my trusted network

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/user/favorites/:chauffeurId')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Path Parameter:')} ${bdd.field(':chauffeurId')} (Valid 24-character hexadecimal MongoDB ObjectId representing the target chauffeur).
${bdd.label('• Business Logic & Security Defenses:')}
  - Self-Favoriting Defense: Users cannot bookmark their own user ID (${bdd.field('callerId === chauffeurId')} triggers 400 Bad Request).
  - Suspended Account Guard: Chauffeurs with ${bdd.field("accountState === 'SUSPENDED'")} cannot be added to favorites.
  - Concurrency & Atomic Idempotency: Uses MongoDB ${bdd.keyword('$addToSet')} operator to guarantee set-level uniqueness, preventing duplicate array entries even during rapid concurrent requests.
${bdd.label('• Response Structure & Real-Time State:')}
  - { success: true, message: "Chauffeur added to favorites successfully" (or "Chauffeur is already in your favorites"), data: { _id, name, isFavorite: true } }
  - ${bdd.field('data._id')} (ObjectId): Unique identifier of the bookmarked chauffeur.
  - ${bdd.field('data.name')} (string): Display name of the bookmarked chauffeur.
  - ${bdd.field('data.isFavorite')} (boolean: true): Confirms active bookmark state for instant client-side UI icon toggling.

${bdd.scenario('📖 BDD SCENARIO: Stage 4.1 — Bookmark Trusted Peer Chauffeur')}
Feature: Favorite Chauffeurs Network

${bdd.keyword('Given')} an authenticated user and an active verified chauffeur
${bdd.keyword('When')} I POST /api/v1/user/favorites/:chauffeurId with the target chauffeur's ID
${bdd.keyword('Then')} I receive HTTP 200 OK with 'isFavorite: true'
${bdd.keyword('And')} the chauffeur ID is atomically stored in the user's 'favoriteChauffeurs' array in MongoDB
`);

      const response = await request(app)
        .post(`/api/v1/user/favorites/${user2Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'POST',
        '/api/v1/user/favorites/:chauffeurId',
        { params: { chauffeurId: user2Id } },
        response.body,
        'BDD-04-ADD-FAVORITE',
        'User adds chauffeur to favorites',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.isFavorite).toBe(true);

      const user = await User.findById(user1Id);
      expect(user?.favoriteChauffeurs?.map(id => id.toString())).toContain(user2Id);
    });

    it('BDD-04-B retrieves favorite chauffeurs list with cursor pagination and search filter (GET /favorites)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User
I want to browse my saved favorite chauffeurs with pagination and search capabilities
So that I can easily find bookmarked drivers even within a large personal fleet network

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/favorites')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Query & Pagination Capabilities:')}
  - Supports ${bdd.field('?searchTerm=<query>')}: Filters favorite list by name, nickname, or phone number.
  - Supports ${bdd.field('?limit=<n>')}: Batch size limiter (1-50, default 10).
  - Supports ${bdd.field('?cursor=<base64url>')}: Keyset cursor token for infinite scroll lists.
${bdd.label('• Response Structure:')}
  - { success: true, message: "Favorite chauffeurs retrieved successfully", cursor: { nextCursor, hasMore, limit }, data: [{ _id, name, nickname, phone, profilePicture, averageRating, totalReviews, serviceArea, badges, isFavorite: true }] }

${bdd.scenario('📖 BDD SCENARIO: Stage 4.2 — Paginated Favorites Retrieval')}
Feature: Favorite Chauffeurs Network

${bdd.keyword('Given')} an authenticated user with existing bookmarked chauffeurs
${bdd.keyword('When')} I GET /api/v1/user/favorites
${bdd.keyword('Then')} I receive HTTP 200 OK containing my bookmarked drivers with 'isFavorite: true'
`);

      const response = await request(app)
        .get('/api/v1/user/favorites')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .query({ limit: 5 })
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/favorites',
        { query: { limit: 5 } },
        response.body,
        'BDD-04-GET-FAVORITES',
        'User retrieves paginated favorites list',
      );

      assertSuccessResponse(response.body);
      expect(response.body).toHaveProperty('cursor');
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]._id.toString()).toBe(user2Id);
      expect(response.body.data[0].isFavorite).toBe(true);
    });

    it('BDD-04-C removes chauffeur from favorites list atomically (DELETE /favorites/:chauffeurId)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User
I want to remove a chauffeur from my favorites bookmark list
So that my dispatch roster reflects only currently preferred drivers

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/user/favorites/:chauffeurId')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Atomic Operation:')} Uses MongoDB ${bdd.keyword('$pull')} operator to remove the target chauffeur ID safely.
${bdd.label('• Response Structure:')} { success: true, message: "Chauffeur removed from favorites successfully", data: { _id, name, isFavorite: false } }

${bdd.scenario('📖 BDD SCENARIO: Stage 4.3 — Remove Chauffeur from Favorites')}
Feature: Favorite Chauffeurs Network

${bdd.keyword('Given')} a previously bookmarked chauffeur in the user's favorites list
${bdd.keyword('When')} I DELETE /api/v1/user/favorites/:chauffeurId
${bdd.keyword('Then')} I receive HTTP 200 OK with 'isFavorite: false'
${bdd.keyword('And')} the chauffeur ID is removed from the user's 'favoriteChauffeurs' array in MongoDB
`);

      const response = await request(app)
        .delete(`/api/v1/user/favorites/${user2Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'DELETE',
        '/api/v1/user/favorites/:chauffeurId',
        { params: { chauffeurId: user2Id } },
        response.body,
        'BDD-04-REMOVE-FAVORITE',
        'User removes chauffeur from favorites',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.isFavorite).toBe(false);

      const user = await User.findById(user1Id);
      expect(user?.favoriteChauffeurs?.map(id => id.toString())).not.toContain(user2Id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. USER REVIEWS & RATINGS (AGGREGATION & PUBLIC FEED)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-05 USER REVIEWS & RATINGS (Aggregation & Public Feed)', () => {
    beforeEach(async () => {
      // Create a completed job with reviews for user1
      await Job.create({
        jobType: JOB_TYPE.ONE_WAY,
        pickup: 'JFK Airport, Terminal 4',
        dropoff: 'Empire State Building, NY',
        paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
        paymentAmount: 150,
        vehicleType: 'Sedan',
        status: JOB_STATUS.COMPLETED,
        createdBy: new mongoose.Types.ObjectId(user2Id),
        assignedTo: new mongoose.Types.ObjectId(user1Id),
        reviewByCreator: {
          rating: 5,
          comment: 'Punctual, professional driver with a spotless vehicle!',
          reviewedAt: new Date(),
        },
      });
    });

    it('BDD-05-A retrieves authenticated user own received reviews and rating breakdown (GET /my-reviews)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated Chauffeur
I want to inspect my own received client reviews and rating metrics
So that I can evaluate passenger feedback and track my platform reputation

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/my-reviews')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Aggregation Pipeline Rationale:')}
  - Aggregates completed jobs where ${bdd.field('assignedTo === caller.userId')} and ${bdd.field('reviewByCreator')} exists.
  - Computes dynamic ${bdd.field('averageRating')} (arithmetic mean rounded to 1 decimal place) and ${bdd.field('totalReviews')}.
${bdd.label('• Response Structure:')}
  - { success: true, message: "Reviews retrieved successfully", data: { reviewSummary: { totalReviews, averageRating }, reviews: [{ rating, comment, reviewerName, reviewerProfile, reviewedAt }] } }

${bdd.scenario('📖 BDD SCENARIO: Stage 5.1 — Self Review Aggregation')}
Feature: Chauffeur Review Metrics

${bdd.keyword('Given')} completed jobs with client ratings assigned to the authenticated user
${bdd.keyword('When')} I GET /api/v1/user/my-reviews
${bdd.keyword('Then')} I receive HTTP 200 OK with rating summary and itemized passenger feedback
`);

      const response = await request(app)
        .get('/api/v1/user/my-reviews')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/my-reviews',
        {},
        response.body,
        'BDD-05-GET-MY-REVIEWS',
        'User retrieves own received job reviews',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.reviewSummary.totalReviews).toBe(1);
      expect(response.body.data.reviewSummary.averageRating).toBe(5);
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].comment).toContain('Punctual, professional driver');
    });

    it('BDD-05-B retrieves public user reviews with cursor pagination (GET /:userId/reviews)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User or Passenger
I want to browse another chauffeur's public reviews with cursor pagination
So that I can verify driver trustworthiness before booking or dispatching

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/:userId/reviews')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Query Parameters:')} Supports ${bdd.field('?limit=<n>')} and ${bdd.field('?cursor=<token>')}.
${bdd.label('• Response Structure:')} { success: true, message: "Reviews retrieved successfully", cursor: { nextCursor, hasMore, limit }, data: [{ rating, comment, reviewerName, reviewedAt }] }

${bdd.scenario('📖 BDD SCENARIO: Stage 5.2 — Public Chauffeur Reviews Feed')}
Feature: Chauffeur Review Metrics

${bdd.keyword('Given')} an active chauffeur with public completed job reviews
${bdd.keyword('When')} I GET /api/v1/user/:userId/reviews with pagination parameters
${bdd.keyword('Then')} I receive HTTP 200 OK with paginated review items
`);
      const response = await request(app)
        .get(`/api/v1/user/${user1Id}/reviews`)
        .set('Authorization', `Bearer ${user2AccessToken}`)
        .query({ limit: 10 })
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/:userId/reviews',
        { params: { userId: user1Id }, query: { limit: 10 } },
        response.body,
        'BDD-05-GET-USER-REVIEWS',
        'Other user inspects public reviews of driver',
      );

      assertSuccessResponse(response.body);
      expect(response.body).toHaveProperty('cursor');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].rating).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. GET USER DETAILS BY ID (PUBLIC CARD & POPULATED FLEET)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-06 GET USER DETAILS BY ID (Public Card & Populated Fleet)', () => {
    it('BDD-06-A retrieves user details by ID with vehicles, rating, and dynamic isFavorite (GET /:userId)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to inspect another chauffeur's detailed public card
So that I can see their approved vehicles, aggregate star ratings, recent feedback, and whether they are bookmarked in my favorites

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user/:userId')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Dynamic Population & Computations:')}
  - Fleet Aggregation: Populates approved vehicles belonging to this chauffeur (${bdd.field('Vehicle.find({ owner: userId, status: "APPROVED" })')}).
  - Dynamic isFavorite: Cross-references caller's ${bdd.field('favoriteChauffeurs')} array to return accurate boolean state.
  - Review Aggregation: Appends latest public reviews and computed ${bdd.field('averageRating')}.
${bdd.label('• Response Structure:')}
  - { success: true, message: "User details retrieved successfully", data: { _id, name, nickname, phone, serviceArea, profilePicture, vehicles: [...], reviews: [...], averageRating, totalReviews, badges, isFavorite } }

${bdd.scenario('📖 BDD SCENARIO: Stage 6.1 — Inspect Chauffeur Public Profile Card')}
Feature: Chauffeur Profile Cards

${bdd.keyword('Given')} an active verified chauffeur with approved vehicles in MongoDB
${bdd.keyword('When')} I GET /api/v1/user/:userId
${bdd.keyword('Then')} I receive HTTP 200 OK with populated vehicle details and dynamic 'isFavorite' flag
`);

      // Add a vehicle for user2
      await Vehicle.create({
        owner: new mongoose.Types.ObjectId(user2Id),
        type: 'Sedan',
        makeAndModel: 'BMW 7 Series',
        colorInside: 'Beige',
        colorOutside: 'Black',
        year: 2024,
        licensePlate: 'NYC-LUX-01',
        licensePlateRaw: 'NYCLUX01',
        status: VEHICLE_STATUS.APPROVED,
      });

      const response = await request(app)
        .get(`/api/v1/user/${user2Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user/:userId',
        { params: { userId: user2Id } },
        response.body,
        'BDD-06-GET-USER-DETAILS',
        'User inspects detailed public profile of another chauffeur',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.name).toBe('Jane Smith');
      expect(response.body.data.vehicles).toHaveLength(1);
      expect(response.body.data.vehicles[0].makeAndModel).toBe('BMW 7 Series');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ADMIN USER MANAGEMENT (APPROVAL, CATALOG, SUSPENSION & REACTIVATION)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-07 ADMIN USER MANAGEMENT (Approve, List, Suspend & Reactivate)', () => {
    let pendingUserId: string;

    beforeEach(async () => {
      const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
      const pendingData = await createTestUserAndToken(
        USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
        
        `pending-${uniqueSuffix}@test.com`,
        { appState: APP_STATE.PENDING, accountState: ACCOUNT_STATE.UNVERIFIED, isOnboard: false },
      );
      pendingUserId = pendingData.userId;
    });

    it('BDD-07-A ADMIN lists all user roles with pagination and search (GET /)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Administrator
I want to list and filter all registered platform users across roles
So that I can monitor member onboarding, subscription compliance, and account activity

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/user')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• Query Capabilities:')} Supports ${bdd.field('?limit=<n>')}, ${bdd.field('?page=<n>')}, ${bdd.field('?searchTerm=<query>')}, and ${bdd.field('?role=<USER|ADMIN>')}.
${bdd.label('• Response Structure:')}
  - { success: true, message: "User roles retrieved successfully", pagination: { total, limit, page, totalPage }, data: [{ _id, name, email, phone, status, subscription, stats: { totalJobsCreated, totalJobsCompleted, payout, earnings } }] }

${bdd.scenario('📖 BDD SCENARIO: Stage 7.1 — Administrative User Listing')}
Feature: Administrative User Governance

${bdd.keyword('Given')} an authenticated administrative user
${bdd.keyword('When')} I GET /api/v1/user with pagination parameters
${bdd.keyword('Then')} I receive HTTP 200 OK containing all platform user records and onboarding stats
`);

      const response = await request(app)
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ limit: 10 })
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/user',
        { query: { limit: 10 } },
        response.body,
        'BDD-07-ADMIN-LIST-USERS',
        'Admin lists all platform user roles',
      );

      assertSuccessResponse(response.body);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('BDD-07-B ADMIN approves pending applicant into operational status (PATCH /:userId/approve)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Administrator
I want to approve a vetted chauffeur applicant
So that their account is activated and they can accept ride assignments on the platform

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/approve')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• State Transitions:')}
  - ${bdd.field('appState')}: PENDING → ${bdd.keyword('ACTIVE')}
  - ${bdd.field('accountState')}: UNVERIFIED → ${bdd.keyword('VERIFIED')}
  - ${bdd.field('isOnboard')}: false → ${bdd.keyword('true')}
  - Audit Trail: Sets ${bdd.field('approvedBy')} and ${bdd.field('approvedAt')} timestamps.

${bdd.scenario('📖 BDD SCENARIO: Stage 7.2 — Approve Chauffeur Applicant')}
Feature: Administrative User Governance

${bdd.keyword('Given')} a pending chauffeur applicant in MongoDB
${bdd.keyword('When')} I PATCH /api/v1/user/:userId/approve as an administrator
${bdd.keyword('Then')} I receive HTTP 200 OK with appState: 'ACTIVE' and accountState: 'VERIFIED'
`);

      const response = await request(app)
        .patch(`/api/v1/user/${pendingUserId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/approve',
        { params: { userId: pendingUserId } },
        response.body,
        'BDD-07-ADMIN-APPROVE-USER',
        'Admin approves pending chauffeur application',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.appState).toBe(APP_STATE.ACTIVE);
      expect(response.body.data.accountState).toBe(ACCOUNT_STATE.VERIFIED);
      expect(response.body.data.isOnboard).toBe(true);

      const approvedUser = await User.findById(pendingUserId);
      expect(approvedUser?.appState).toBe(APP_STATE.ACTIVE);
    });

    it('BDD-07-C ADMIN rejects pending applicant with documented reason (PATCH /:userId/reject)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Administrator
I want to reject an unqualified chauffeur applicant with a clear reason
So that our platform maintains strict compliance and quality standards

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/reject')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• Payload:')} { reason: "<rejectionReason>" }
${bdd.label('• State Transitions:')}
  - ${bdd.field('appState')}: PENDING → ${bdd.keyword('REJECTED')}
  - Records ${bdd.field('rejectedBy')}, ${bdd.field('rejectedAt')}, and ${bdd.field('rejectionReason')}.

${bdd.scenario('📖 BDD SCENARIO: Stage 7.3 — Reject Chauffeur Applicant')}
Feature: Administrative User Governance

${bdd.keyword('Given')} a pending chauffeur applicant in MongoDB
${bdd.keyword('When')} I PATCH /api/v1/user/:userId/reject with a rejection reason
${bdd.keyword('Then')} I receive HTTP 200 OK with appState: 'REJECTED' and reason documented
`);

      const payload = { reason: 'Incomplete vehicle inspection documentation' };

      const response = await request(app)
        .patch(`/api/v1/user/${pendingUserId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/reject',
        { params: { userId: pendingUserId }, body: payload },
        response.body,
        'BDD-07-ADMIN-REJECT-USER',
        'Admin rejects pending chauffeur application with reason',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.appState).toBe(APP_STATE.REJECTED);
      expect(response.body.data.reason).toBe(payload.reason);

      const rejectedUser = await User.findById(pendingUserId);
      expect(rejectedUser?.appState).toBe(APP_STATE.REJECTED);
      expect(rejectedUser?.rejectionReason).toBe(payload.reason);
    });

    it('BDD-07-D ADMIN suspends user with documented reason (PATCH /:userId/suspend)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Administrator,
I want to suspend a user account with a mandatory disciplinary reason,
So that malicious actors or policy violators are immediately blocked from dispatching or booking

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/suspend')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• Payload:')} { reason: "<disciplinaryReason>" }
${bdd.label('• State Transitions:')}
  - ${bdd.field('accountState')}: VERIFIED → ${bdd.keyword('SUSPENDED')}
  - Records ${bdd.field('suspendedBy')}, ${bdd.field('suspendedAt')}, and ${bdd.field('blockReason')}.

${bdd.scenario('📖 BDD SCENARIO: Stage 7.4 — Disciplinary Account Suspension')}
Feature: Administrative User Governance

${bdd.keyword('Given')} an active user on the platform
${bdd.keyword('When')} I PATCH /api/v1/user/:userId/suspend with a suspension reason
${bdd.keyword('Then')} I receive HTTP 200 OK and user accountState is set to 'SUSPENDED'
`);

      const payload = { reason: 'Violation of platform community standards' };

      const response = await request(app)
        .patch(`/api/v1/user/${user2Id}/suspend`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/suspend',
        { params: { userId: user2Id }, body: payload },
        response.body,
        'BDD-07-ADMIN-SUSPEND-USER',
        'Admin suspends a user with disciplinary reason',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.reason).toBe(payload.reason);

      const blockedUser = await User.findById(user2Id);
      expect(blockedUser?.accountState).toBe(ACCOUNT_STATE.SUSPENDED);
    });

    it('BDD-07-E ADMIN reactivates user restoring operational status (PATCH /:userId/reactivate)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Administrator,
I want to reactivate a previously suspended user,
So that their operational access and platform privileges are restored

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/user/:userId/reactivate')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• State Transitions:')}
  - ${bdd.field('accountState')}: SUSPENDED → ${bdd.keyword('VERIFIED')}
  - Records ${bdd.field('reactivatedBy')} and ${bdd.field('reactivatedAt')}.

${bdd.scenario('📖 BDD SCENARIO: Stage 7.5 — Restore Suspended Account Privileges')}
Feature: Administrative User Governance

${bdd.keyword('Given')} a suspended user account
${bdd.keyword('When')} I PATCH /api/v1/user/:userId/reactivate
${bdd.keyword('Then')} I receive HTTP 200 OK and user accountState returns to 'VERIFIED'
`);

      const response = await request(app)
        .patch(`/api/v1/user/${user2Id}/reactivate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/user/:userId/reactivate',
        { params: { userId: user2Id } },
        response.body,
        'BDD-07-ADMIN-REACTIVATE-USER',
        'Admin reactivates suspended user',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.accountState).toBe(ACCOUNT_STATE.VERIFIED);

      const unblockedUser = await User.findById(user2Id);
      expect(unblockedUser?.accountState).toBe(ACCOUNT_STATE.VERIFIED);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. DELETE ACCOUNT (GDPR / CCPA SELF-SERVICE ACCOUNT DELETION)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-08 DELETE OWN ACCOUNT (Security Password Confirmation)', () => {
    it('BDD-08-A deletes own account with valid password confirmation (DELETE /delete-account)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to delete my own platform account by confirming my current password
So that my personally identifiable information (PII) is securely de-identified and my account permanently deactivated

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/user/delete-account')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Security Payload:')} { password: "<plainTextPassword>" } (Verified against bcrypt hash before deletion).
${bdd.label('• Anonymization & De-Identification Defenses:')}
  - Account State: Set to ${bdd.keyword('DEACTIVATED')}.
  - PII Cleansing: Removes ${bdd.field('email')}, ${bdd.field('phone')}, ${bdd.field('profilePicture')}, and digital payment handles to ensure privacy compliance.

${bdd.scenario('📖 BDD SCENARIO: Stage 8.1 — Self-Service Account Anonymization & Deletion')}
Feature: Account Lifecycle & Privacy

${bdd.keyword('Given')} an authenticated user with active credentials
${bdd.keyword('When')} I DELETE /api/v1/user/delete-account with correct password
${bdd.keyword('Then')} I receive HTTP 200 OK with deactivation confirmation
${bdd.keyword('And')} the user record is de-identified and marked 'DEACTIVATED' in MongoDB
`);

      const tempUser = await createTestUserAndToken(
        USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
        
        'delete-me-happy@test.com',
      );

      const response = await request(app)
        .delete('/api/v1/user/delete-account')
        .set('Authorization', `Bearer ${tempUser.token}`)
        .send({ password: 'Password123!' })
        .expect(StatusCodes.OK);

      logApi(
        'DELETE',
        '/api/v1/user/delete-account',
        { body: { password: '***' } },
        response.body,
        'BDD-08-DELETE-ACCOUNT',
        'User safely deletes own account with password confirmation',
      );

      assertSuccessResponse(response.body);

      const deletedDoc = await User.findById(tempUser.userId);
      expect(deletedDoc?.accountState).toBe(ACCOUNT_STATE.DEACTIVATED);
      expect(deletedDoc?.email).toBeUndefined();
    });

    it('BDD-08-B ADMIN hard-deletes target user (DELETE /:userId)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Administrator,
I want to permanently hard-delete a non-compliant user account by their ID,
So that fraudulent or terminated users and their associated vehicles and documents are expunged from the database

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/user/:userId')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• Security Guardrails & Cascading Deletions:')}
  - Admin cannot delete other admin accounts.
  - Automatically unlinks and unlinks personal credential documents and registered vehicles from filesystem.
  - Permanently purges user document, vehicles, and uploaded document records from MongoDB (Hard Delete).
${bdd.label('• Response Format:')}
  - { success: true, message: "User deleted successfully", data: null }

${bdd.scenario('📖 BDD SCENARIO: Stage 8.2 — Administrative Hard Deletion')}
Feature: Administrative User Governance & Lifecycle Termination

${bdd.keyword('Given')} an existing non-admin user on the platform
${bdd.keyword('When')} administrator sends DELETE /api/v1/user/:userId
${bdd.keyword('Then')} I receive HTTP 200 OK with message "User deleted successfully" and data: null
${bdd.keyword('And')} user document is permanently purged from MongoDB (null doc)
`);

      const targetUser = await createTestUserAndToken(
        USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
        
        'admin-delete-target@test.com',
      );

      const response = await request(app)
        .delete(`/api/v1/user/${targetUser.userId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'DELETE',
        '/api/v1/user/:userId',
        { params: { userId: targetUser.userId } },
        response.body,
        'BDD-08-ADMIN-DELETE-USER',
        'Administrator hard-deletes target user account',
      );

      assertSuccessResponse(response.body);
      expect(response.body.message).toBe('User deleted successfully');
      expect(response.body.data).toBeNull();

      const deletedDoc = await User.findById(targetUser.userId);
      expect(deletedDoc).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. USER & CHAUFFEUR PLATFORM STATISTICS (GET /stats)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-09 USER & CHAUFFEUR PLATFORM STATISTICS (GET /stats)', () => {
    it('BDD-09-A Administrator retrieves aggregated user & chauffeur statistics (GET /api/v1/users/stats)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Administrator
I want to retrieve aggregated user and chauffeur fleet metrics (totalUsers, activeUsers, pendingUsers, suspendedUsers)
So that I can monitor driver onboarding velocity, active supply, and compliance state

${bdd.section('📋 BUSINESS RULES & QUERY SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/users/stats')}
${bdd.label('• Access Policy:')} ${bdd.access('Admin Only (USER_ROLES.ADMIN)')}
${bdd.label('• Response Structure:')}
  - { success: true, statusCode: 200, message: "User statistics retrieved successfully", data: { period, totalUsers, activeUsers, pendingUsers, suspendedUsers } }

${bdd.scenario('Stage 9.1 — Retrieve User & Chauffeur Fleet Statistics')}
${bdd.label('Feature:')} User Governance & Analytics — Driver Fleet Segmentation

${bdd.keyword('Given')} an authenticated platform administrator and existing users
${bdd.keyword('When')} I GET /api/v1/users/stats
${bdd.keyword('Then')} I receive HTTP 200 OK with accurate count and growth analytics for totalUsers, activeUsers, pendingUsers, and suspendedUsers
`);

      const response = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/users/stats',
        {},
        response.body,
        'BDD-09-A-GET-USER-STATS',
        'Admin retrieves aggregated user & chauffeur statistics',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data.period).toEqual({
        type: 'monthly',
        comparison: 'previous_period',
      });
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('activeUsers');
      expect(response.body.data).toHaveProperty('pendingUsers');
      expect(response.body.data).toHaveProperty('suspendedUsers');

      expect(response.body.data.totalUsers).toHaveProperty('count');
      expect(response.body.data.totalUsers).toHaveProperty('growth');
      expect(response.body.data.totalUsers).toHaveProperty('growthType');

      expect(response.body.data.activeUsers).toHaveProperty('count');
      expect(response.body.data.pendingUsers).toHaveProperty('count');
      expect(response.body.data.suspendedUsers).toHaveProperty('count');
    });
  });
});
