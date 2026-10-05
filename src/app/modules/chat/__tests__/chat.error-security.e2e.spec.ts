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
import mongoose, { Types } from 'mongoose';
import chalk from 'chalk';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../../../../app';
import { Chat } from '../chat.model';
import { Message } from '../../message/message.model';
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
let user1AccessToken: string;
let user1Id: string;
let user2AccessToken: string;
let user2Id: string;
let outsiderAccessToken: string;
let outsiderId: string;
let suspendedAccessToken: string;
let suspendedUserId: string;


const assertErrorResponse = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
};

const assertSuccessResponse = (body: any) => {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  name: string,
  role: string,
  companyRole: string,
  email: string,
  accountState = 'VERIFIED',
) => {
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
    name,
    email,
    password: 'Password123!',
    phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    role,
    companyRole,
    accountState,
  });

  const token = jwtHelper.createToken(
    { id: userId, userId, role, email, accountState },
    config.jwt.jwt_secret as string,
    '1h',
  );
  return { userId, token };
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  await Chat.deleteMany({});
  await Message.deleteMany({});

  const u1 = await createTestUserAndToken(
    'Alice Chauffeur',
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'chat-user1@test.com',
  );
  user1AccessToken = u1.token;
  user1Id = u1.userId;

  const u2 = await createTestUserAndToken(
    'Bob Driver',
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'chat-user2@test.com',
  );
  user2AccessToken = u2.token;
  user2Id = u2.userId;

  const outsider = await createTestUserAndToken(
    'Outsider Attacker',
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'chat-outsider@test.com',
  );
  outsiderAccessToken = outsider.token;
  outsiderId = outsider.userId;

  const suspended = await createTestUserAndToken(
    'Suspended BadUser',
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'chat-suspended@test.com',
    'SUSPENDED',
  );
  suspendedAccessToken = suspended.token;
  suspendedUserId = suspended.userId;
});


afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Chat Module E2E Tests - Errors, Validation & Security', () => {
  beforeEach(async () => {
    await Chat.deleteMany({});
    await Message.deleteMany({});
  });

  afterEach(async () => {
    await Chat.deleteMany({});
    await Message.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION & ACCESS CONTROL (401 UNAUTHORIZED)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 AUTH & RBAC: Token Security & Authentication Guards', () => {
    it('BDD-01-A Unauthenticated GET /api/v1/chats returns 401 Unauthorized', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Security Guard
I want to block anyone without a login token from accessing the chat inbox
So that stranger or unverified requests cannot view private communications

${bdd.section('💡 SIMPLE EXPLANATION:')}
Calling GET /api/v1/chats without an Authorization header is rejected with HTTP 401.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Expected Error Response:')} 401 Unauthorized
`);

      const response = await request(app)
        .get('/api/v1/chats')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/chats',
        {},
        response.body,
        'BDD-01-ERR-UNAUTH-INBOX',
        'Rejects missing token on inbox with 401 Unauthorized',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-B Unauthenticated POST /api/v1/chats returns 401 Unauthorized', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Security Guard
I want to block unauthenticated requests from creating chat rooms
So that only logged-in platform members can start conversations

${bdd.section('💡 SIMPLE EXPLANATION:')}
Calling POST /api/v1/chats without a Bearer token is rejected with HTTP 401.
`);

      const payload = { participantId: user2Id };
      const response = await request(app)
        .post('/api/v1/chats')
        .send(payload)
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: payload },
        response.body,
        'BDD-01-ERR-UNAUTH-CREATE',
        'Rejects unauthenticated chat creation with 401 Unauthorized',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-C Unauthenticated GET /api/v1/chats/:chatId returns 401 Unauthorized', async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/v1/chats/${fakeId}`)
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/chats/:chatId',
        { params: { chatId: fakeId } },
        response.body,
        'BDD-01-ERR-UNAUTH-GET-BY-ID',
        'Rejects unauthenticated chat detail retrieval with 401 Unauthorized',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-D Unauthenticated DELETE /api/v1/chats/:chatId returns 401 Unauthorized', async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/chats/${fakeId}`)
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'DELETE',
        '/api/v1/chats/:chatId',
        { params: { chatId: fakeId } },
        response.body,
        'BDD-01-ERR-UNAUTH-DELETE',
        'Rejects unauthenticated chat deletion with 401 Unauthorized',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-E Request with fake or tampered JWT token returns 401 Unauthorized', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Security Guard
I want to reject fake or forged JWT tokens
So that attackers cannot bypass authentication with forged credentials
`);

      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', 'Bearer fake.or.tampered.token')
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        '/api/v1/chats',
        {},
        response.body,
        'BDD-01-ERR-FORGED-TOKEN',
        'Rejects tampered JWT credentials with 401 Unauthorized',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-F Suspended user CAN access GET /api/v1/chats (to view existing history / support)', async () => {
      const response = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${suspendedAccessToken}`)
        .expect(StatusCodes.OK);

      assertSuccessResponse(response.body);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('BDD-01-G Suspended user CANNOT initiate a new chat via POST /api/v1/chats (returns 403 Forbidden)', async () => {
      const payload = { participantId: user1Id };
      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${suspendedAccessToken}`)
        .send(payload)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: payload },
        response.body,
        'BDD-01-ERR-SUSPENDED-CREATE',
        'Rejects suspended user creating new chats with 403 Forbidden',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('restricted');
    });

    it('BDD-01-H Suspended user CANNOT delete a chat via DELETE /api/v1/chats/:chatId (returns 403 Forbidden)', async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/chats/${fakeId}`)
        .set('Authorization', `Bearer ${suspendedAccessToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'DELETE',
        '/api/v1/chats/:chatId',
        { params: { chatId: fakeId } },
        response.body,
        'BDD-01-ERR-SUSPENDED-DELETE',
        'Rejects suspended user deleting chats with 403 Forbidden to prevent evidence tampering',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('restricted');
    });
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VALIDATION ERRORS & SCHEMA GUARDS (400 BAD REQUEST)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 VALIDATION & SCHEMA GUARDS (400 Bad Request)', () => {
    it('BDD-02-A Missing participantId in body returns 400 Bad Request', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an API Validator
I want to reject requests that do not specify who to chat with
So that incomplete requests fail immediately with a clear error message

${bdd.section('💡 SIMPLE EXPLANATION:')}
Calling POST /api/v1/chats with an empty body {} returns HTTP 400 with "Participant ID is required".

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Zod Validation Rule:')} participantId is required (min length 1)
`);

      const payload = {};
      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: payload },
        response.body,
        'BDD-02-ERR-MISSING-PARTICIPANT',
        'Rejects missing participantId with 400 Bad Request',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-02-B Empty string participantId returns 400 Bad Request', async () => {
      const payload = { participantId: '' };
      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: payload },
        response.body,
        'BDD-02-ERR-EMPTY-PARTICIPANT',
        'Rejects empty string participantId with 400 Bad Request',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-02-C Self-Chat Prevention: Alice attempting to chat with herself returns 400 Bad Request', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Business Logic Validator
I want to prevent a user from opening a private chat with their own account
So that every chat channel represents a valid conversation between 2 distinct people

${bdd.section('💡 SIMPLE EXPLANATION:')}
If Alice tries to start a chat where participantId is Alice's own ID, the backend
returns HTTP 400 with "You cannot start a chat with yourself".

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Self-Chat Rejection Policy:')} If requesterId === participantId, throw 400 ApiError

${bdd.scenario('📖 BDD SCENARIO: Stage 2.E1 — Self-Chat Rejection')}
Feature: Self-Chat Guard

${bdd.keyword('Given')} Alice is logged in
${bdd.keyword('When')} Alice sends POST /api/v1/chats with participantId=Alice
${bdd.keyword('Then')} The server returns HTTP 400 Bad Request
${bdd.keyword('And')} The error message states "You cannot start a chat with yourself"
`);

      const payload = { participantId: user1Id };
      const response = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: payload },
        response.body,
        'BDD-02-ERR-SELF-CHAT',
        'Rejects self-chat attempt with 400 Bad Request',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('You cannot start a chat with yourself');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. IDOR & PRIVACY DEFENSE (404 NOT FOUND)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 IDOR DEFENSE & CHANNEL PRIVACY (404 Not Found)', () => {
    it('BDD-03-A IDOR Read Attack: Outsider cannot view private conversation between Alice and Bob', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Security Guard (IDOR Protection)
I want to prevent non-participating users from viewing chats between other members
So that conversations remain completely private and confidential

${bdd.section('💡 SIMPLE EXPLANATION:')}
Alice and Bob have a private chat room. An outsider tries to open GET /api/v1/chats/:chatId.
The backend checks if the caller is in the participants list. Since Outsider is not,
it returns HTTP 404 ("Chat not found") to prevent leaking messages or channel existence.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/chats/:chatId')}
${bdd.label('• Security Policy:')} Query filters by {_id: chatId, participants: caller.userId}
${bdd.label('• Expected Response:')} 404 Not Found ("Chat not found") to avoid leaking channel existence

${bdd.scenario('📖 BDD SCENARIO: Stage 3.E1 — IDOR Channel Snooping Defense')}
Feature: Private Messaging Channel Privacy

${bdd.keyword('Given')} Alice and Bob have an existing private chat
${bdd.keyword('When')} An outsider user sends GET /api/v1/chats/:chatId
${bdd.keyword('Then')} The server returns HTTP 404 Not Found
${bdd.keyword('And')} No message history or participant data is exposed
`);

      const privateChat = await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        lastMessage: 'Confidential business dispatch',
        lastMessageAt: new Date(),
        createdBy: new Types.ObjectId(user1Id),
      });

      const response = await request(app)
        .get(`/api/v1/chats/${privateChat._id}`)
        .set('Authorization', `Bearer ${outsiderAccessToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'GET',
        '/api/v1/chats/:chatId',
        { params: { chatId: privateChat._id.toString() } },
        response.body,
        'BDD-03-ERR-IDOR-READ',
        'Rejects non-participant inspection with 404 Not Found',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Chat not found');
    });

    it('BDD-03-B IDOR Delete Attack: Outsider cannot delete private conversation between Alice and Bob', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Security Guard (IDOR Tampering Protection)
I want to prevent unauthorized users from deleting another user\'s conversation
So that chats and messages are protected from malicious deletion attempts

${bdd.section('💡 SIMPLE EXPLANATION:')}
If an outsider sends DELETE /api/v1/chats/:chatId for a chat they do not belong to,
the backend returns HTTP 404 and leaves the chat room and all messages completely intact.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/chats/:chatId')}
${bdd.label('• Expected Error Response:')} 404 Not Found
`);

      const privateChat = await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        lastMessage: 'Protected conversation',
        lastMessageAt: new Date(),
        createdBy: new Types.ObjectId(user1Id),
      });

      // Add a message to verify it is NOT deleted
      await Message.create({
        chatId: privateChat._id,
        sender: new Types.ObjectId(user1Id),
        text: 'Important intact message',
      });

      const response = await request(app)
        .delete(`/api/v1/chats/${privateChat._id}`)
        .set('Authorization', `Bearer ${outsiderAccessToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'DELETE',
        '/api/v1/chats/:chatId',
        { params: { chatId: privateChat._id.toString() } },
        response.body,
        'BDD-03-ERR-IDOR-DELETE',
        'Rejects non-participant deletion with 404 Not Found',
      );

      assertErrorResponse(response.body);

      // Verify chat and messages remain completely untouched
      const intactChat = await Chat.findById(privateChat._id);
      expect(intactChat).not.toBeNull();

      const msgCount = await Message.countDocuments({ chatId: privateChat._id });
      expect(msgCount).toBe(1);
    });

    it('BDD-03-C Fetching non-existent chatId returns 404 Not Found', async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/v1/chats/${fakeId}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'GET',
        '/api/v1/chats/:chatId',
        { params: { chatId: fakeId } },
        response.body,
        'BDD-03-ERR-NONEXISTENT-GET',
        'Rejects non-existent chatId with 404 Not Found',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Chat not found');
    });

    it('BDD-03-D Deleting non-existent chatId returns 404 Not Found', async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/chats/${fakeId}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'DELETE',
        '/api/v1/chats/:chatId',
        { params: { chatId: fakeId } },
        response.body,
        'BDD-03-ERR-NONEXISTENT-DELETE',
        'Rejects deleting non-existent chatId with 404 Not Found',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Chat not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CONCURRENCY & RACE CONDITION DEFENSE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-04 CONCURRENCY & DUPLICATE KEY DEFENSE', () => {
    it('BDD-04-A Rapid simultaneous clicks to create a chat resolve safely to the same room', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a System Reliability Guard
I want simultaneous parallel requests to create the same chat room to resolve gracefully
So that rapid double-clicks on mobile devices never crash the server with duplicate key errors

${bdd.section('💡 SIMPLE EXPLANATION:')}
If Alice double-taps "Message Bob" rapidly, firing 3 requests at the exact same millisecond,
MongoDB unique indexes catch the race condition and return the single room safely with HTTP 200.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Concurrency Behavior:')} Catches MongoDB E11000 duplicate key error code and queries back existing room.
`);

      // Fire 3 concurrent requests for the same participant pair
      const results = await Promise.all([
        request(app)
          .post('/api/v1/chats')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({ participantId: user2Id }),
        request(app)
          .post('/api/v1/chats')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({ participantId: user2Id }),
        request(app)
          .post('/api/v1/chats')
          .set('Authorization', `Bearer ${user2AccessToken}`)
          .send({ participantId: user1Id }),
      ]);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: { participantId: user2Id }, concurrency: 3 },
        results[0].body,
        'BDD-04-CONCURRENCY-DEDUP',
        '3 simultaneous parallel creation requests deduplicate into a single chat room',
      );

      // All 3 requests should succeed with 200 OK
      results.forEach(res => {
        expect(res.status).toBe(StatusCodes.OK);
        assertSuccessResponse(res.body);
      });

      // All returned chat IDs should match
      const chatIds = results.map(r => r.body.data.id);
      expect(chatIds[0]).toBe(chatIds[1]);
      expect(chatIds[1]).toBe(chatIds[2]);

      // Exactly 1 chat document exists in MongoDB
      const totalChats = await Chat.countDocuments({});
      expect(totalChats).toBe(1);
    });
  });
});
