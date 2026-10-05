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
import { Message } from '../message.model';
import { Chat } from '../../chat/chat.model';
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
let aliceToken: string;
let aliceId: string;
let bobToken: string;
let bobId: string;
let activeChatId: string;

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
  const userId = new mongoose.Types.ObjectId().toString();
  await User.create({
    _id: userId,
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
    USER_ROLES.USER,
    COMPANY_ROLE.OWNER,
    'alice-happy@test.com',
    'Alice Sender',
  );
  aliceId = alice.userId;
  aliceToken = alice.token;

  const bob = await createTestUserAndToken(
    USER_ROLES.USER,
    COMPANY_ROLE.CHAUFFEUR,
    'bob-happy@test.com',
    'Bob Receiver',
  );
  bobId = bob.userId;
  bobToken = bob.token;

  const chat = await createTestChat(aliceId, bobId);
  activeChatId = chat._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Message Module E2E Tests - Happy Paths & Business Workflows', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SEND MESSAGES (Direct, Attachments, Reply, Multipart)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 SEND MESSAGES: Real-Time Messaging & Chat State Mutations', () => {
    it('BDD-01-A Alice sends a direct plaintext message in the chat room', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As an Authenticated Chat Participant (Alice)
I want to send a direct text message to Bob
So that we can coordinate ride schedules and logistical requirements in real time

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Access Requirement:')} ${bdd.access('Chat Participant (USER or ADMIN)')}
${bdd.label('• Mandatory & Optional Fields:')}
  - ${bdd.field('text')} (string | optional): Message textual body (max 4000 characters).
  - ${bdd.field('attachments')} (string[] | optional): URLs of uploaded multimedia documents or images.
  - ${bdd.field('replyTo')} (ObjectId | optional): Reference to another existing message ID within the same chat.
  - ${bdd.field('chatId')} (ObjectId in route param): Target chat session.
${bdd.label('• State Transitions & Side Effects:')}
  - Inserts new Message document with ${bdd.field('sender')} = Alice and ${bdd.field('readBy')} = [Alice].
  - Mutates parent Chat document: ${bdd.field('lastMessage')} = text preview (first 100 chars), ${bdd.field('lastMessageAt')} = timestamp.
  - Triggers fire-and-forget notification pipeline and WebSocket emit for the counter-participant (Bob).
${bdd.label('• Response Structure:')}
  - { success: true, statusCode: 201, message: "Message sent successfully", data: IMessage }

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Send Direct Plaintext Message')}
Feature: Chat Messaging Pipeline

${bdd.keyword('Given')} Alice and Bob are active participants in an established Chat room
${bdd.keyword('When')} Alice sends a POST request with a valid textual payload
${bdd.keyword('Then')} the API responds with HTTP 201 Created and the persisted Message payload
${bdd.keyword('And')} the parent Chat's lastMessage and lastMessageAt metadata fields are updated accordingly
`);

      const payload = {
        text: 'Hello Bob! Can you confirm your ETA at Terminal 3?',
      };

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(payload)
        .expect(StatusCodes.CREATED);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId }, body: payload },
        response.body,
        'BDD-01-A-SEND-TEXT-MESSAGE',
        'Direct text message sent successfully',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.text).toBe(payload.text);
      expect(response.body.data.attachments).toEqual([]);

      // Verify chat preview updated
      const updatedChat = await Chat.findById(activeChatId).lean();
      expect(updatedChat?.lastMessage).toBe(payload.text);
      expect(updatedChat?.lastMessageAt).toBeDefined();
    });

    it('BDD-01-B Bob replies with media attachments array', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Chat Participant (Bob)
I want to attach images or document links with my message
So that I can provide visual confirmations, boarding passes, or parking receipts

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Payload:')} { text: "Attached parking receipt", attachments: ["https://cdn.example.com/receipt.jpg", "https://cdn.example.com/gate.png"] }
${bdd.label('• Verification:')} Message attachments are normalized and persisted as string array
`);

      const payload = {
        text: 'Attached is the parking pass and terminal gate picture.',
        attachments: [
          'https://cdn.example.com/receipt.jpg',
          'https://cdn.example.com/gate-t3.png',
        ],
      };

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send(payload)
        .expect(StatusCodes.CREATED);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId }, body: payload },
        response.body,
        'BDD-01-B-SEND-ATTACHMENTS',
        'Message with multiple attachments sent successfully',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.text).toBe(payload.text);
      expect(response.body.data.attachments).toHaveLength(2);
      expect(response.body.data.attachments[0]).toBe('https://cdn.example.com/receipt.jpg');
    });

    it('BDD-01-C sends message using singular "image" alias field', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Mobile Client App
I want to submit image attachments using the singular 'image' key
So that standard single-image upload form payloads are seamlessly accepted

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Normalization Rule:')} Backend normalizes 'image' | 'file' | 'files' into standard 'attachments' array
`);

      const payload = {
        text: 'Vehicle condition snapshot',
        image: 'https://cdn.example.com/car-front.jpg',
      };

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send(payload)
        .expect(StatusCodes.CREATED);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId }, body: payload },
        response.body,
        'BDD-01-C-IMAGE-ALIAS-FIELD',
        'Singular image payload normalized into attachments array',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.attachments).toEqual(['https://cdn.example.com/car-front.jpg']);
    });

    it('BDD-01-D Alice replies to a specific previous message (Threaded replyTo)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice in an ongoing conversation
I want to reference a specific earlier message in my reply
So that Bob knows exactly which statement or document I am responding to

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/messages/:chatId')}
${bdd.label('• Validation:')} 'replyTo' must be a valid 24-hex ObjectId existing in the same chatId
`);

      const targetMessage = await Message.findOne({ chatId: activeChatId, sender: bobId }).lean();
      expect(targetMessage).toBeDefined();

      const payload = {
        text: 'Understood! I will meet you at Gate T3.',
        replyTo: targetMessage?._id.toString(),
      };

      const response = await request(app)
        .post(`/api/v1/messages/${activeChatId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send(payload)
        .expect(StatusCodes.CREATED);

      logApi(
        'POST',
        `/api/v1/messages/${activeChatId}`,
        { params: { chatId: activeChatId }, body: payload },
        response.body,
        'BDD-01-D-THREADED-REPLY',
        'Threaded reply created with verified replyTo message reference',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.replyTo?.toString()).toBe(targetMessage?._id.toString());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GET MESSAGES WITH CURSOR PAGINATION & SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 GET MESSAGES: Cursor Pagination, Search & Auto-Read Marker', () => {
    beforeEach(async () => {
      // Seed 25 deterministic messages for robust pagination and search tests
      await Message.deleteMany({ chatId: activeChatId });

      const messagesToSeed = Array.from({ length: 25 }, (_, i) => ({
        chatId: new mongoose.Types.ObjectId(activeChatId),
        sender: i % 2 === 0 ? new mongoose.Types.ObjectId(aliceId) : new mongoose.Types.ObjectId(bobId),
        text: `Message #${i + 1} - ${i === 15 ? 'CRITICAL_KEYWORD_DISPATCH' : 'Standard coordination text'}`,
        readBy: [new mongoose.Types.ObjectId(aliceId)],
      }));

      await Message.insertMany(messagesToSeed);
    });

    it('BDD-02-A Bob retrieves initial batch of messages and marks unread messages as read', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Bob opening the chat screen
I want to fetch the latest 10 messages with pagination cursor metadata
So that I can read the conversation and automatically clear unread notification badges

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/messages/:chatId?limit=10')}
${bdd.label('• Cursor Metadata:')}
  - ${bdd.field('cursor.limit')} (number): Current batch size (10).
  - ${bdd.field('cursor.hasMore')} (boolean): True when older historical messages exist.
  - ${bdd.field('cursor.nextCursor')} (base64url): Opaque pointer encoding oldest _id in the batch.
${bdd.label('• Side Effect:')} All unread messages in the chat room are marked read by Bob ($addToSet readBy).
`);

      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}?limit=10`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}?limit=10`,
        { params: { chatId: activeChatId }, query: { limit: 10 } },
        response.body,
        'BDD-02-A-GET-MESSAGES-PAGE-1',
        'First batch of 10 messages retrieved and auto-marked as read',
      );

      assertSuccessResponse(response.body);
      expect(response.body).toHaveProperty('cursor');
      expect(response.body.cursor.limit).toBe(10);
      expect(response.body.cursor.hasMore).toBe(true);
      expect(response.body.cursor.nextCursor).toBeDefined();
      expect(response.body.data).toHaveLength(10);

      // Verify bounded unread marking: 10 fetched messages are marked read, leaving 15 unread
      const unreadCount = await Message.countDocuments({
        chatId: activeChatId,
        readBy: { $ne: new mongoose.Types.ObjectId(bobId) },
      });
      expect(unreadCount).toBe(15);
    });


    it('BDD-02-B Bob scrolls up to paginate older messages using nextCursor token', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Bob scrolling upwards in the chat history
I want to request the next batch of older messages using the opaque nextCursor
So that I can load previous conversations seamlessly without duplicates or shifts

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/messages/:chatId?limit=10&cursor=<base64url>')}
${bdd.label('• Invariant:')} Page 1 and Page 2 must have zero overlapping message IDs (completely disjoint).
`);

      // 1. Fetch first batch
      const page1Res = await request(app)
        .get(`/api/v1/messages/${activeChatId}?limit=10`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(StatusCodes.OK);

      const nextCursor = page1Res.body.cursor.nextCursor;
      expect(nextCursor).toBeTruthy();

      // 2. Fetch second batch using cursor
      const page2Res = await request(app)
        .get(`/api/v1/messages/${activeChatId}?limit=10&cursor=${nextCursor}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}?limit=10&cursor=${nextCursor}`,
        { params: { chatId: activeChatId }, query: { limit: 10, cursor: nextCursor } },
        page2Res.body,
        'BDD-02-B-GET-MESSAGES-PAGE-2',
        'Second batch of older messages loaded via cursor token',
      );

      assertSuccessResponse(page2Res.body);
      expect(page2Res.body.data).toHaveLength(10);
      expect(page2Res.body.cursor.hasMore).toBe(true);

      // Verify zero overlap between page 1 and page 2
      const page1Ids = page1Res.body.data.map((m: any) => (m._id || m.id)?.toString());
      const page2Ids = page2Res.body.data.map((m: any) => (m._id || m.id)?.toString());
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('BDD-02-C reaches the oldest message boundary (hasMore: false, nextCursor: null)', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Mobile/Web Client
I want to detect when the start of the chat conversation is reached
So that infinite scrolling loaders can be deactivated cleanly

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Boundary Case:')} When all available messages in the chat have been delivered
${bdd.label('• Expected:')} { cursor: { hasMore: false, nextCursor: null } }
`);

      // Fetch with limit exceeding total message count (30 > 25)
      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}?limit=30`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}?limit=30`,
        { params: { chatId: activeChatId }, query: { limit: 30 } },
        response.body,
        'BDD-02-C-REACH-CHAT-BEGINNING',
        'All chat messages delivered with hasMore=false and nextCursor=null',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveLength(25);
      expect(response.body.cursor.hasMore).toBe(false);
      expect(response.body.cursor.nextCursor).toBeNull();
    });

    it('BDD-02-D searches messages within the chat room by keyword', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice searching in a long conversation
I want to filter messages containing a specific search keyword
So that I can locate critical instructions or reference numbers instantly

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/messages/:chatId?searchTerm=CRITICAL_KEYWORD_DISPATCH')}
`);

      const response = await request(app)
        .get(`/api/v1/messages/${activeChatId}?searchTerm=CRITICAL_KEYWORD_DISPATCH`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        `/api/v1/messages/${activeChatId}?searchTerm=CRITICAL_KEYWORD_DISPATCH`,
        { params: { chatId: activeChatId }, query: { searchTerm: 'CRITICAL_KEYWORD_DISPATCH' } },
        response.body,
        'BDD-02-D-SEARCH-MESSAGES',
        'Search query returned exact matching message',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].text).toContain('CRITICAL_KEYWORD_DISPATCH');
    });
  });
});
