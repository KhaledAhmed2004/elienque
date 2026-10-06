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
import { Message } from '../message.model';
import { Chat } from '../../chat/chat.model';
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
let aliceToken: string;
let aliceId: string;
let bobToken: string;
let bobId: string;
let charlieToken: string; // Outsider / Non-participant
let charlieId: string;
let activeChatId: string;

const assertErrorResponse = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  role: string,
  
  email: string,
  name: string,
) => {
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
    name,
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

const createTestChat = async (user1Id: string, user2Id: string) => {
  const chat = await Chat.create({
    participants: [new mongoose.Types.ObjectId(user1Id), new mongoose.Types.ObjectId(user2Id)],
    createdBy: new mongoose.Types.ObjectId(user1Id),
  });
  return chat;
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  await User.deleteMany({});
  await Chat.deleteMany({});
  await Message.deleteMany({});

  const alice = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'alice-err@test.com',
    'Alice Sender',
  );
  aliceId = alice.userId;
  aliceToken = alice.token;

  const bob = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'bob-err@test.com',
    'Bob Participant',
  );
  bobId = bob.userId;
  bobToken = bob.token;

  const charlie = await createTestUserAndToken(
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'charlie-outsider@test.com',
    'Charlie Outsider',
  );
  charlieId = charlie.userId;
  charlieToken = charlie.token;

  const chat = await createTestChat(aliceId, bobId);
  activeChatId = chat._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Message Module E2E Tests - Errors, Validation & Security Boundaries', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTH & PARTICIPANT ACCESS CONTROL (401 / 403 / 404)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 AUTH & ACCESS CONTROL: Unauthorized & Non-Participant Protection', () => {
    it('BDD-01-A unauthenticated request cannot send message (401 Unauthorized)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an API Security Layer
I want to reject anonymous unauthenticated message creation
So that unverified visitors cannot post spam or pollute ongoing discussions

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Expected Error:')} 401 Unauthorized
`);

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .send({ text: 'Unauthorized message attempt' })
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { body: { text: 'Unauthorized message attempt' } },
        response.body,
        'BDD-01-A-UNAUTH-SEND',
        'Unauthenticated message send rejected with 401',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-B unauthenticated request cannot get messages (401 Unauthorized)', async () => {
      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}`)
        .expect(StatusCodes.UNAUTHORIZED);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId } },
        response.body,
        'BDD-01-B-UNAUTH-GET',
        'Unauthenticated message retrieval rejected with 401',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-C outsider user (Charlie) cannot send message to a chat they do not belong to', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Chat Security Barrier
I want to prevent non-participants from injecting messages into private chats
So that private conversation confidentiality is strictly maintained

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Expected Error:')} 404 Not Found (Chat lookup scoped to authenticated user participants)
`);

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ text: 'Intruding into conversation' })
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId }, body: { text: 'Intruding into conversation' } },
        response.body,
        'BDD-01-C-NON-PARTICIPANT-SEND',
        'Non-participant message send rejected with 404 Not Found',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-01-D outsider user (Charlie) cannot get messages from a private chat (403 Forbidden)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Data Privacy Guard
I want to deny chat message reading access to non-participants
So that users cannot eavesdrop on conversations between other members

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Expected Error:')} 403 Forbidden ('You are not a participant of this chat')
`);

      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(StatusCodes.FORBIDDEN);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId } },
        response.body,
        'BDD-01-D-NON-PARTICIPANT-GET',
        'Non-participant access rejected with 403 Forbidden',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('not a participant');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VALIDATION ERRORS (400 Bad Request)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 VALIDATION: Payload Constraints & Cursor Verification (400 Bad Request)', () => {
    it('BDD-02-A sending empty message (no text, no attachments) returns 400 Bad Request', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Validation Middleware
I want to reject completely blank message payloads
So that empty or meaningless documents are never written to MongoDB

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Rule:')} At least one of 'text' or 'attachments' must be provided
${bdd.label('• Expected Error:')} 400 Bad Request
`);

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({})
        .expect(StatusCodes.BAD_REQUEST);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { body: {} },
        response.body,
        'BDD-02-A-EMPTY-MESSAGE',
        'Empty message payload rejected with 400 Bad Request',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-02-B sending message exceeding 4000 characters returns 400 Bad Request', async () => {
      const hugeText = 'X'.repeat(4001);

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: hugeText })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-C sending message with invalid replyTo format returns 400 Bad Request', async () => {
      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Valid text', replyTo: 'invalid-non-hex-id-123' })
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
    });

    it('BDD-02-D retrieving messages with corrupted base64 cursor token returns 400 Bad Request', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Keyset Query Engine
I want to reject corrupted or tampered cursor strings with 400 Bad Request
So that malformed query inputs do not trigger unhandled internal server exceptions

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/messages/:chatId?cursor=corrupted-token')}
`);

      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}?cursor=corrupted-invalid-token`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(StatusCodes.BAD_REQUEST);

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Invalid cursor');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NOT FOUND SCENARIOS (404 Not Found)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 NOT FOUND: Missing Chats & Invalid Referenced Replies (404 Not Found)', () => {
    it('BDD-03-A sending message to a non-existent chatId returns 404 Not Found', async () => {
      const nonExistentChatId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/api/v1/messages/${nonExistentChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Hello into the void' })
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'POST',
        `/api/v1/messages/${nonExistentChatId}`,
        { params: { chatId: nonExistentChatId } },
        response.body,
        'BDD-03-A-NON-EXISTENT-CHAT',
        'Message send to missing chat rejected with 404',
      );

      assertErrorResponse(response.body);
    });

    it('BDD-03-B replying to a non-existent message returns 404 Not Found', async () => {
      const nonExistentMsgId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Replying to ghost message', replyTo: nonExistentMsgId })
        .expect(StatusCodes.NOT_FOUND);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { body: { text: 'Replying to ghost message', replyTo: nonExistentMsgId } },
        response.body,
        'BDD-03-B-NON-EXISTENT-REPLY-TO',
        'Reply to missing message rejected with 404',
      );

      assertErrorResponse(response.body);
      expect(response.body.message).toContain('Referenced message not found');
    });
  });
});
