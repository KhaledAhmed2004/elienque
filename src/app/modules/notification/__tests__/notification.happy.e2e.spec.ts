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

const assertSuccessResponse = (body: any) => {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('message');
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
    'user-notif-happy@test.com',
    'Standard User',
  );
  userId = user.userId;
  userToken = user.token;

  const otherUser = await createTestUserAndToken(
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'other-notif-happy@test.com',
    'Other User',
  );
  otherUserId = otherUser.userId;
  otherUserToken = otherUser.token;

  const admin = await createTestUserAndToken(
    USER_ROLES.ADMIN,
    COMPANY_ROLE.OWNER,
    'admin-notif-happy@test.com',
    'Admin User',
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

describe('Notification Module E2E Tests - Happy Paths & Business Workflows', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. USER NOTIFICATIONS (List, Mark Read, Mark Unread, Mark All Read, Delete)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 USER NOTIFICATIONS: Retrieval, Read Status & Lifecycle', () => {
    it('BDD-01-A User retrieves personal notifications in descending chronological order', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to retrieve my received notifications ordered from newest to oldest
So that I stay informed about account updates, chat messages, and job alerts

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/notifications')}
${bdd.label('• Access Requirement:')} ${bdd.access('USER or ADMIN')}
${bdd.label('• Behavior:')} Returns all notifications where receiver = authenticated user, sorted by createdAt DESC
`);

      // Seed 3 notifications with distinct timestamps
      const olderNotif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Older Notification: Vehicle profile updated',
        title: 'Vehicle Update',
        isRead: false,
        createdAt: new Date(Date.now() - 60000),
      });

      const newerNotif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Newer Notification: New bid received on your job',
        title: 'New Bid',
        isRead: false,
        createdAt: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/notifications',
        {},
        response.body,
        'BDD-01-A-LIST-NOTIFICATIONS',
        'User retrieves notifications sorted newest first',
      );

      assertSuccessResponse(response.body);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]._id.toString()).toBe(newerNotif._id.toString());
      expect(response.body.data[1]._id.toString()).toBe(olderNotif._id.toString());
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('BDD-01-A2 User retrieves notifications using Cursor Pagination for Infinite Scroll', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Mobile App User
I want to fetch my notifications feed with cursor-based pagination
So that infinite scrolling works smoothly without duplicate items

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/notifications?limit=2&cursor=...')}
${bdd.label('• Expected:')} Returns cursor metadata { nextCursor, hasMore, limit }
`);

      // Seed 3 notifications
      const notif1 = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Feed Item 1',
        createdAt: new Date(Date.now() - 3000),
      });
      const notif2 = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Feed Item 2',
        createdAt: new Date(Date.now() - 2000),
      });
      const notif3 = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Feed Item 3',
        createdAt: new Date(Date.now() - 1000),
      });

      // Page 1 with limit=2 (Cursor mode triggered with cursor='')
      const page1Res = await request(app)
        .get('/api/v1/notifications?limit=2&cursor=')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      assertSuccessResponse(page1Res.body);
      expect(page1Res.body.cursor).toBeDefined();
      expect(page1Res.body.cursor.hasMore).toBe(true);
      expect(page1Res.body.cursor.nextCursor).toBeDefined();
      expect(page1Res.body.data).toHaveLength(2);

      const nextCursor = page1Res.body.cursor.nextCursor;

      // Page 2 using nextCursor
      const page2Res = await request(app)
        .get(`/api/v1/notifications?limit=2&cursor=${nextCursor}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      assertSuccessResponse(page2Res.body);
      expect(page2Res.body.cursor).toBeDefined();
      expect(page2Res.body.cursor.hasMore).toBe(false);
      expect(page2Res.body.data).toHaveLength(1);
    });


    it('BDD-01-B User marks a specific unread notification as read', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to mark a specific notification as read after viewing it
So that my unread notification badge is updated

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/:notificationId/read')}
${bdd.label('• Payload:')} { read: true } (optional, defaults to true)
${bdd.label('• State Transition:')} notification.isRead changes from false to true
`);

      const notif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Important task deadline reminder',
        title: 'Task Reminder',
        isRead: false,
      });

      const response = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ read: true })
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        `/api/v1/notifications/${notif._id}/read`,
        { params: { notificationId: notif._id.toString() }, body: { read: true } },
        response.body,
        'BDD-01-B-MARK-READ',
        'Specific notification marked as read',
      );

      assertSuccessResponse(response.body);
      expect(response.body.message).toBe('Notification marked read');
      expect(response.body.data.isRead).toBe(true);

      const updated = await Notification.findById(notif._id).lean();
      expect(updated?.isRead).toBe(true);
    });

    it('BDD-01-C User toggles a notification back to unread status', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to toggle a read notification back to unread
So that I can follow up on it later

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/:notificationId/read')}
${bdd.label('• Payload:')} { read: false }
${bdd.label('• State Transition:')} notification.isRead changes from true to false
`);

      const notif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Follow-up document verification needed',
        title: 'Verification',
        isRead: true,
      });

      const response = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ read: false })
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        `/api/v1/notifications/${notif._id}/read`,
        { params: { notificationId: notif._id.toString() }, body: { read: false } },
        response.body,
        'BDD-01-C-MARK-UNREAD',
        'Notification toggled back to unread',
      );

      assertSuccessResponse(response.body);
      expect(response.body.message).toBe('Notification marked unread');
      expect(response.body.data.isRead).toBe(false);

      const updated = await Notification.findById(notif._id).lean();
      expect(updated?.isRead).toBe(false);
    });

    it('BDD-01-D User marks all unread notifications as read in bulk', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to clear all unread notification badges in a single action
So that I do not have to click each notification individually

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/read-all')}
${bdd.label('• Access Requirement:')} ${bdd.access('USER or ADMIN')}
${bdd.label('• State Transition:')} All user-owned notifications with isRead: false become isRead: true
`);

      // Seed 4 notifications for userId (3 unread, 1 already read)
      await Notification.create([
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Msg 1', isRead: false },
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Msg 2', isRead: false },
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Msg 3', isRead: false },
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Msg 4', isRead: true },
      ]);

      // Seed 1 unread notification for otherUserId (should remain untouched)
      await Notification.create({
        receiver: new mongoose.Types.ObjectId(otherUserId),
        text: 'Other user notification',
        isRead: false,
      });

      const response = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/notifications/read-all',
        {},
        response.body,
        'BDD-01-D-MARK-ALL-READ',
        'All unread notifications marked as read',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.updated).toBe(true);

      // Verify all notifications for userId are now read
      const unreadCount = await Notification.countDocuments({
        receiver: new mongoose.Types.ObjectId(userId),
        isRead: false,
      });
      expect(unreadCount).toBe(0);

      // Verify other user's notification was NOT touched
      const otherUnread = await Notification.countDocuments({
        receiver: new mongoose.Types.ObjectId(otherUserId),
        isRead: false,
      });
      expect(otherUnread).toBe(1);
    });

    it('BDD-01-E User permanently deletes a notification owned by them', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated User
I want to delete a notification that is no longer needed
So that my notification inbox remains clutter-free

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/notifications/:notificationId')}
${bdd.label('• Access Requirement:')} ${bdd.access('USER or ADMIN (Must be Owner)')}
${bdd.label('• State Transition:')} Document is removed from MongoDB
`);

      const notif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(userId),
        text: 'Temporary promo code notification',
        title: 'Promotion',
        isRead: true,
      });

      const response = await request(app)
        .delete(`/api/v1/notifications/${notif._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'DELETE',
        `/api/v1/notifications/${notif._id}`,
        { params: { notificationId: notif._id.toString() } },
        response.body,
        'BDD-01-E-DELETE-NOTIFICATION',
        'User deletes owned notification',
      );

      assertSuccessResponse(response.body);
      expect(response.body.message).toBe('Notification deleted');
      expect(response.body.data.deleted).toBe(true);

      const exists = await Notification.findById(notif._id);
      expect(exists).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ADMIN NOTIFICATIONS (Admin list, Mark Read, Mark All Read via unified routes)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 ADMIN NOTIFICATIONS: Administrative Alerts & Endpoints', () => {
    it('BDD-02-A Admin retrieves admin-scoped notification stream', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform Administrator
I want to view administrative alerts and system escalation notifications
So that I can respond to critical events across the platform

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/notifications')}
${bdd.label('• Access Requirement:')} ${bdd.access('ADMIN (Authenticated)')}
`);

      await Notification.create({
        receiver: new mongoose.Types.ObjectId(adminId),
        text: 'Admin Alert: New chauffeur identity verification submitted',
        title: 'KYC Pending',
        type: 'ADMIN',
        isRead: false,
      });

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/notifications',
        {},
        response.body,
        'BDD-02-A-ADMIN-LIST',
        'Admin retrieves admin-specific notification list',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('KYC Pending');
    });

    it('BDD-02-B Admin marks specific notification as read via admin route', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Administrator
I want to mark an admin notification as read
So that my team knows the item has been reviewed

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/:notificationId/read')}
${bdd.label('• Access Requirement:')} ${bdd.access('ADMIN (Authenticated Owner)')}
`);

      const adminNotif = await Notification.create({
        receiver: new mongoose.Types.ObjectId(adminId),
        text: 'Admin alert: High value transaction pending escrow release',
        title: 'Escrow Review',
        isRead: false,
      });

      const response = await request(app)
        .patch(`/api/v1/notifications/${adminNotif._id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ read: true })
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        `/api/v1/notifications/${adminNotif._id}/read`,
        { params: { notificationId: adminNotif._id.toString() } },
        response.body,
        'BDD-02-B-ADMIN-MARK-READ',
        'Admin marks notification as read',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.isRead).toBe(true);
    });

    it('BDD-02-C Admin marks all notifications as read in bulk via admin route', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Administrator
I want to mark all administrative notifications as read in bulk
So that I can clear daily system audit logs

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('PATCH')} ${bdd.endpoint('/api/v1/notifications/read-all')}
${bdd.label('• Access Requirement:')} ${bdd.access('ADMIN (Authenticated)')}
`);

      await Notification.create([
        { receiver: new mongoose.Types.ObjectId(adminId), text: 'Admin alert 1', isRead: false },
        { receiver: new mongoose.Types.ObjectId(adminId), text: 'Admin alert 2', isRead: false },
      ]);

      const response = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'PATCH',
        '/api/v1/notifications/read-all',
        {},
        response.body,
        'BDD-02-C-ADMIN-MARK-ALL-READ',
        'Admin marks all notifications as read',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.updated).toBe(true);

      const unreadCount = await Notification.countDocuments({
        receiver: new mongoose.Types.ObjectId(adminId),
        isRead: false,
      });
      expect(unreadCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MULTI-USER ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 DATA ISOLATION: Multi-Tenant & Multi-User Notification Privacy', () => {
    it('BDD-03-A User A only receives User A notifications and never sees User B notifications', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Data Privacy Architecture
I want strict receiver query isolation on all notification listing endpoints
So that no user can observe notifications intended for other platform accounts

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/notifications')}
${bdd.label('• Privacy Guarantee:')} Notifications with receiver != authenticated userId are never returned
`);

      // Seed 2 notifications for Alice and 3 for Bob
      await Notification.create([
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Alice Private 1' },
        { receiver: new mongoose.Types.ObjectId(userId), text: 'Alice Private 2' },
        { receiver: new mongoose.Types.ObjectId(otherUserId), text: 'Bob Private 1' },
        { receiver: new mongoose.Types.ObjectId(otherUserId), text: 'Bob Private 2' },
        { receiver: new mongoose.Types.ObjectId(otherUserId), text: 'Bob Private 3' },
      ]);

      const aliceResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(StatusCodes.OK);

      expect(aliceResponse.body.data).toHaveLength(2);
      aliceResponse.body.data.forEach((n: any) => {
        expect(n.receiver.toString()).toBe(userId);
      });

      const bobResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(StatusCodes.OK);

      expect(bobResponse.body.data).toHaveLength(3);
      bobResponse.body.data.forEach((n: any) => {
        expect(n.receiver.toString()).toBe(otherUserId);
      });
    });
  });
});
