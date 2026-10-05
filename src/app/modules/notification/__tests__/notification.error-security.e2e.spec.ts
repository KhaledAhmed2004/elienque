import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { Notification } from '../notification.model';
import { User } from '../../user/user.model';
import { USER_ROLES, COMPANY_ROLE } from '../../../../enums/user';
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
let userToken: string;
let userId: string;
let otherUserToken: string;
let otherUserId: string;
let adminToken: string;
let adminId: string;

const assertErrorResponse = (body: any, expectedMessageSubstring?: string) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
  if (expectedMessageSubstring) {
    expect(body.message.toLowerCase()).toContain(expectedMessageSubstring.toLowerCase());
  }
};

const createTestUserAndToken = async (
  role: string,
  companyRole: string,
  email: string,
  name: string,
) => {
  const newUserId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: newUserId,
    name,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    companyRole,
    accountState: 'VERIFIED',
    profilePicture: 'https://example.com/avatar.png',
  });

  const token = jwtHelper.createToken(
    { id: newUserId, userId: newUserId, role, email },
    config.jwt.jwt_secret as string,
    '1h',
  );
  return { userId: newUserId, token };
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  await Notification.deleteMany({});

  const user = await createTestUserAndToken(
    USER_ROLES.USER,
    COMPANY_ROLE.OWNER,
    'alice-notif-security@test.com',
    'Alice Security',
  );
  userId = user.userId;
  userToken = user.token;

  const otherUser = await createTestUserAndToken(
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'bob-notif-security@test.com',
    'Bob Attacker',
  );
  otherUserId = otherUser.userId;
  otherUserToken = otherUser.token;

  const admin = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    COMPANY_ROLE.OWNER,
    'admin-notif-security@test.com',
    'Admin Security',
  );
  adminId = admin.userId;
  adminToken = admin.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Notification.deleteMany({});
});

describe('Notification Module E2E Tests - Errors, Validation & Security Boundaries', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION & ACCESS CONTROL (401 Unauthorized & 403 Forbidden)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 AUTH & RBAC: Token Verification and Role Enforcement', () => {
    it('BDD-01-A unauthenticated request cannot list notifications (401 Unauthorized)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an API Gatekeeper
I want to deny notification listing to unauthenticated visitors
So that private user activity remains confidential

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/notifications')}
${bdd.label('• Expected Error:')} 401 Unauthorized
`);

      const response = await request(app)
        .get('/api/v1/notifications')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/notifications',
        {},
        response.body,
        'BDD-01-A-UNAUTH-GET',
        'Unauthenticated listing rejected with 401',
      );

      assertErrorResponse(response.body, 'token');
    });

    it('BDD-01-B unauthenticated request cannot mark notification read (401 Unauthorized)', async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .patch(`/api/v1/notifications/${dummyId}/read`)
        .send({ read: true })
        .expect(StatusCodes.UNAUTHORIZED);

      assertErrorResponse(response.body, 'token');
    });

    it('BDD-01-C unauthenticated request cannot mark all read (401 Unauthorized)', async () => {
      const response = await request(app)
        .patch('/api/v1/notifications/read-all')
        .expect(StatusCodes.UNAUTHORIZED);

      assertErrorResponse(response.body, 'token');
    });

    it('BDD-01-D unauthenticated request cannot delete notification (401 Unauthorized)', async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/notifications/${dummyId}`)
        .expect(StatusCodes.UNAUTHORIZED);

      assertErrorResponse(response.body, 'token');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. IDOR & OWNERSHIP BOUNDARIES (403 Forbidden)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 IDOR & NOTIFICATION OWNERSHIP: Cross-User Tampering Defense', () => {
    it('BDD-02-A User B cannot mark User A notification as read (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an IDOR Defense Guard
I want to prevent Bob from modifying the read status of Alice's notifications
So that users cannot tamper with other members' inboxes

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/:notificationId/read')}
${bdd.label('• Ownership Rule:')} notification.receiver must strictly match caller JWT ID
${bdd.label('• Expected Error:')} 403 Forbidden ('Not authorized')
`);

      // Alice's notification
      const aliceNotif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: "Alice's confidential message notification",
        isRead: false,
      });

      // Bob tries to mark Alice's notification as read
      const response = await request(app)
        .patch(`/api/v1/notifications/${aliceNotif._id}/read`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ read: true })
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'PATCH',
        `/api/v1/notifications/${aliceNotif._id}/read`,
        { params: { notificationId: aliceNotif._id.toString() }, caller: 'Bob' },
        response.body,
        'BDD-02-A-IDOR-MARK-READ',
        'Cross-user mark-read rejected with 403 Not authorized',
      );

      assertErrorResponse(response.body, 'Not authorized');

      // Verify Alice's notification was NOT modified
      const untouched = await Notification.findById(aliceNotif._id).lean();
      expect(untouched?.isRead).toBe(false);
    });

    it('BDD-02-B User B cannot delete User A notification (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an IDOR Defense Guard
I want to prevent Bob from deleting Alice's notifications
So that malicious actors cannot purge other users' inbox history

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/notifications/:notificationId')}
${bdd.label('• Ownership Rule:')} notification.receiver must match caller JWT ID
${bdd.label('• Expected Error:')} 403 Forbidden ('Not authorized')
`);

      const aliceNotif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: "Alice's important invoice notification",
        isRead: true,
      });

      // Bob tries to delete Alice's notification
      const response = await request(app)
        .delete(`/api/v1/notifications/${aliceNotif._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'DELETE',
        `/api/v1/notifications/${aliceNotif._id}`,
        { params: { notificationId: aliceNotif._id.toString() }, caller: 'Bob' },
        response.body,
        'BDD-02-B-IDOR-DELETE',
        'Cross-user delete rejected with 403 Not authorized',
      );

      assertErrorResponse(response.body, 'Not authorized');

      // Verify document still exists in MongoDB
      const stillExists = await Notification.findById(aliceNotif._id);
      expect(stillExists).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NOT FOUND & RESILIENCE BOUNDARIES (404 Not Found)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 NOT FOUND: Missing Entity Lookups and Operations', () => {
    it('BDD-03-A marking non-existent notification as read returns 404 Not Found', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an API Consumer
I want clear 404 Not Found error responses when attempting to update a missing notification ID
So that client apps can gracefully handle deleted or expired items

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/:notificationId/read')}
${bdd.label('• Expected Error:')} 404 Not Found ('Notification not found')
`);

      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/api/v1/notifications/${nonExistentId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ read: true })
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'PATCH',
        `/api/v1/notifications/${nonExistentId}/read`,
        { params: { notificationId: nonExistentId } },
        response.body,
        'BDD-03-A-NOT-FOUND-READ',
        'Non-existent notification update rejected with 404',
      );

      assertErrorResponse(response.body, 'Notification not found');
    });

    it('BDD-03-B deleting non-existent notification returns 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/v1/notifications/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'DELETE',
        `/api/v1/notifications/${nonExistentId}`,
        { params: { notificationId: nonExistentId } },
        response.body,
        'BDD-03-B-NOT-FOUND-DELETE',
        'Non-existent notification deletion rejected with 404',
      );

      assertErrorResponse(response.body, 'Notification not found');
    });
  });
});
