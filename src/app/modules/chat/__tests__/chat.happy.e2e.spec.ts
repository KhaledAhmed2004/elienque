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
import { Item } from '../../item/item.model';
import { Job } from '../../job/job.model';
import { Support } from '../../support/support.model';
import { ITEM_CONDITION, ITEM_STATUS } from '../../item/item.interface';
import { JOB_TYPE, PAYMENT_TYPE, JOB_STATUS } from '../../job/job.interface';
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
let adminId: string;
let user1AccessToken: string;
let user1Id: string;
let user2AccessToken: string;
let user2Id: string;
let user3AccessToken: string;
let user3Id: string;

const assertSuccessResponse = (body: any) => {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('message');
};

const createTestUserAndToken = async (
  name: string,
  role: string,
  
  email: string,
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
    profilePicture: 'https://example.com/avatars/user.jpg',
  });

  const token = jwtHelper.createToken(
    { id: userId, userId, role, email },
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
  await Item.deleteMany({});
  await Job.deleteMany({});
  await Support.deleteMany({});

  const adminData = await createTestUserAndToken(
    'Admin User',
    USER_ROLES.ADMIN,
    
    'admin-chat@test.com',
  );
  adminAccessToken = adminData.token;
  adminId = adminData.userId;

  const u1Data = await createTestUserAndToken(
    'Alice Chauffeur',
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'alice-chat@test.com',
  );
  user1AccessToken = u1Data.token;
  user1Id = u1Data.userId;

  const u2Data = await createTestUserAndToken(
    'Bob Driver',
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'bob-chat@test.com',
  );
  user2AccessToken = u2Data.token;
  user2Id = u2Data.userId;

  const u3Data = await createTestUserAndToken(
    'Charlie Dispatch',
    USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER,
    
    'charlie-chat@test.com',
  );
  user3AccessToken = u3Data.token;
  user3Id = u3Data.userId;
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Chat Module E2E Tests - Happy Paths & Business Workflows', () => {
  beforeEach(async () => {
    await Chat.deleteMany({});
    await Message.deleteMany({});
    await Item.deleteMany({});
    await Job.deleteMany({});
    await Support.deleteMany({});
  });

  afterEach(async () => {
    await Chat.deleteMany({});
    await Message.deleteMany({});
    await Item.deleteMany({});
    await Job.deleteMany({});
    await Support.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CREATE / INITIATE CHATS (DIRECT, ITEM-LINKED, JOB-LINKED & SUPPORT)
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CREATE / INITIATE CHATS (DIRECT, ITEM-LINKED, JOB-LINKED & SUPPORT)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-01 CREATE / GET-OR-CREATE CHATS (Direct, Context Linking & Idempotency)', () => {
    it('BDD-01-A Unified Chat Lifecycle: Initiates direct & contextual chats (item/job/support) with idempotency and dynamic updating', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As a Platform User (Alice)
I want to initiate direct chats as well as contextual chats (marketplace item, dispatch ride, or support ticket)
So that Bob and I can communicate seamlessly with full context attached, without duplicate rooms ever being created

${bdd.section('💡 SIMPLE EXPLANATION (Unified Get-or-Create & Context Linking):')}
POST /api/v1/chats acts as a smart Get-or-Create endpoint handling:
1. Direct 1-on-1 Chat: Calling with { participantId } creates a room on 1st call, and returns the existing room on 2nd call (Idempotency).
2. Marketplace Item Chat: Calling with { participantId, itemId } links the product listing (title, price, photos).
3. Dispatch Ride Chat: Calling with { participantId, jobId } links the ride details (pickup, dropoff, payment).
4. Support Ticket Chat: Calling with { participantId, supportId } links the helpdesk ticket.
5. Dynamic Context Updating: Providing a new itemId/jobId on an existing chat updates the link dynamically without creating a duplicate room.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/chats')} (Get-or-Create)
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Mandatory Fields & Validation Rationale:')}
  - ${bdd.field('participantId')} (string): Target user MongoDB ObjectId (24 hex characters).
  - ${bdd.field('itemId')} (string | optional): Linked marketplace item for listing inquiries.
  - ${bdd.field('jobId')} (string | optional): Linked dispatch ride for job discussions.
  - ${bdd.field('supportId')} (string | optional): Linked support ticket for customer care.
${bdd.label('• Idempotency & Unique Constraint:')}
  - ${bdd.field('conversationKey')} (string): Deterministic sorted pair [userA, userB].sort().join('_') enforcing unique constraint in MongoDB to guarantee 1-on-1 channel integrity.
${bdd.label('• Populated Context Attributes:')}
  - ${bdd.field('itemId')}: title, photos, price, condition, status, location
  - ${bdd.field('jobId')}: jobType, pickup, dropoff, date, time, paymentAmount, status
  - ${bdd.field('supportId')}: subject

${bdd.scenario('📖 BDD SCENARIO: Stage 1.1 — Unified Direct & Contextual Chat Lifecycle')}
Feature: Private & Contextual Messaging (Get-or-Create)

${bdd.keyword('Given')} two registered users Alice and Bob
${bdd.keyword('When')} Alice sends POST /api/v1/chats with Bob's participantId
${bdd.keyword('Then')} A brand-new chat room is created with HTTP 200 OK
${bdd.keyword('When')} Alice sends POST /api/v1/chats with Bob's participantId a second time
${bdd.keyword('Then')} The server returns the identical chat room ID (Idempotency)
${bdd.keyword('When')} Alice sends POST /api/v1/chats with itemId, jobId, or supportId
${bdd.keyword('Then')} The conversation is dynamically updated with populated context details
`);

      // ── 1. Direct 1-on-1 Chat Initiation (1st Call) ──
      const directPayload = {
        participantId: user2Id,
      };

      const res1 = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send(directPayload)
        .expect(StatusCodes.OK);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: directPayload },
        res1.body,
        'BDD-01-GET-OR-CREATE-CHAT',
        'Alice initiates direct chat with Bob with Get-or-Create idempotency and context linking',
      );

      assertSuccessResponse(res1.body);
      expect(res1.body.data).toBeDefined();
      expect(res1.body.data.id).toBeDefined();
      expect(res1.body.data.participants).toHaveLength(2);

      const firstChatId = res1.body.data.id;
      const savedChat = await Chat.findById(firstChatId);
      expect(savedChat).not.toBeNull();
      expect(savedChat?.createdBy.toString()).toBe(user1Id);
      expect(savedChat?.conversationKey).toBe(
        [user1Id, user2Id].sort().join('_'),
      );

      // ── 2. Idempotent 2nd Call (Get Existing Room) ──
      const res2 = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send(directPayload)
        .expect(StatusCodes.OK);

      assertSuccessResponse(res2.body);
      expect(res2.body.data.id).toBe(firstChatId);
      const totalChats = await Chat.countDocuments({});
      expect(totalChats).toBe(1);

      // ── 3. Marketplace Item-Linked Context ──
      const item = await Item.create({
        title: 'Luxury Leather Seat Covers',
        price: 150,
        condition: ITEM_CONDITION.NEW,
        location: 'Manhattan Garage',
        description: 'Premium black leather seat covers',
        photos: ['https://example.com/seat-cover.jpg'],
        status: ITEM_STATUS.AVAILABLE,
        createdBy: new Types.ObjectId(user2Id),
      });

      const resItem = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ participantId: user2Id, itemId: item._id.toString() })
        .expect(StatusCodes.OK);

      assertSuccessResponse(resItem.body);
      expect(resItem.body.data.id).toBe(firstChatId);
      expect(resItem.body.data.itemId).toBeDefined();
      expect(resItem.body.data.itemId.title).toBe('Luxury Leather Seat Covers');
      expect(resItem.body.data.itemId.price).toBe(150);

      // ── 4. Dispatch Job-Linked Context ──
      const job = await Job.create({
        jobType: JOB_TYPE.ONE_WAY,
        pickup: 'JFK Airport Terminal 4',
        dropoff: 'The Plaza Hotel, NYC',
        date: new Date('2026-09-01T14:00:00Z'),
        time: '14:00',
        vehicleType: 'Executive Sedan',
        paymentAmount: 180,
        paymentType: PAYMENT_TYPE.COLLECT_PAYMENT,
        status: JOB_STATUS.PENDING,
        createdBy: new Types.ObjectId(user2Id),
      });

      const resJob = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ participantId: user2Id, jobId: job._id.toString() })
        .expect(StatusCodes.OK);

      assertSuccessResponse(resJob.body);
      expect(resJob.body.data.id).toBe(firstChatId);
      expect(resJob.body.data.jobId).toBeDefined();
      expect(resJob.body.data.jobId.pickup).toBe('JFK Airport Terminal 4');
      expect(resJob.body.data.jobId.paymentAmount).toBe(180);

      // ── 5. Support Helpdesk Ticket Context ──
      const support = await Support.create({
        subject: 'Billing Inquiry for August Dispatch',
        user: new Types.ObjectId(user1Id),
        messages: [
          {
            sender: new Types.ObjectId(user1Id),
            message: 'Need help with invoice #1042',
          },
        ],
      });

      const resSupport = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ participantId: adminId, supportId: support._id.toString() })
        .expect(StatusCodes.OK);

      assertSuccessResponse(resSupport.body);
      expect(resSupport.body.data.supportId).toBeDefined();
      expect(resSupport.body.data.supportId.subject).toBe(
        'Billing Inquiry for August Dispatch',
      );
    });

    it('BDD-01-B Two-Way Channel Symmetry and Platform Administrator Direct Access', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Platform Users and Administrators
I want bidirectional chat symmetry and platform-wide administrator messaging
So that conversations remain unified regardless of who initiated them, and admins can reach any user

${bdd.section('💡 SIMPLE EXPLANATION (Channel Symmetry & Admin Capabilities):')}
• Symmetrical Channel Resolution: Whether Alice messages Bob or Bob messages Alice, both resolve to the exact same room ID via conversationKey.
• Admin Access: Platform Administrators can start a direct 1-on-1 chat with any registered user for account support.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('POST')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (USER or ADMIN)')}
${bdd.label('• Deterministic Resolution:')} ${bdd.field('conversationKey')} ([userA, userB].sort().join('_'))

${bdd.scenario('📖 BDD SCENARIO: Stage 1.2 — Symmetrical Channel Resolution & Admin Messaging')}
Feature: Symmetrical Messaging & Administrative Access

${bdd.keyword('Given')} Alice initiated a chat with Bob
${bdd.keyword('When')} Bob sends POST /api/v1/chats with Alice's participantId
${bdd.keyword('Then')} Bob receives the exact same chat room ID without duplicate creation
${bdd.keyword('When')} a Platform Administrator sends POST /api/v1/chats with Alice's ID
${bdd.keyword('Then')} A valid 1-on-1 admin channel is established
`);

      // 1. Alice creates room
      const res1 = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ participantId: user2Id })
        .expect(StatusCodes.OK);

      const originalChatId = res1.body.data.id;

      // 2. Bob reaches out to Alice (resolves to same room)
      const res2 = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${user2AccessToken}`)
        .send({ participantId: user1Id })
        .expect(StatusCodes.OK);

      logApi(
        'POST',
        '/api/v1/chats',
        { body: { participantId: user1Id } },
        res2.body,
        'BDD-01-SYMMETRY-ADMIN',
        'Bob messages Alice resolving to identical room, and Admin initiates direct chat',
      );

      assertSuccessResponse(res2.body);
      expect(res2.body.data.id).toBe(originalChatId);
      const totalChats = await Chat.countDocuments({
        conversationKey: [user1Id, user2Id].sort().join('_'),
      });
      expect(totalChats).toBe(1);

      // 3. Platform Admin initiates direct chat with Alice
      const resAdmin = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ participantId: user1Id })
        .expect(StatusCodes.OK);

      assertSuccessResponse(resAdmin.body);
      expect(resAdmin.body.data.id).toBeDefined();
      expect(resAdmin.body.data.participants).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GET MY CHATS (INBOX FEED, UNREAD BADGES, PRIVACY & UNIVERSAL SEARCH)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-02 GET MY CHATS (Inbox Feed, Dynamic Unread Badges & Universal Search)', () => {
    it('BDD-02-A User (Alice) views inbox feed with chronological sorting, dynamic unread badge counters, and privacy isolation', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice (a Platform User)
I want to view my conversation inbox sorted with the most recent messages on top, with accurate unread message counters
So that I can quickly spot conversations needing my reply, while other users cannot snoop on my private chats

${bdd.section('💡 SIMPLE EXPLANATION (Inbox Feed Lifecycle & Dynamic Unread Badges):')}
• Chronological Sorting: Conversations are returned sorted by lastMessageAt descending (newest activity first).
• Dynamic Unread Badges: For recipient Alice, unread messages count towards unreadCount and set isRead=false. For the sender (Bob), unreadCount=0 and isRead=true.
• Empty State: New users with zero chats safely receive an empty list [].
• Privacy Isolation: Non-participating users (Charlie) cannot see private conversations between Alice and Bob.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/chats')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (Caller must be in chat.participants)')}
${bdd.label('• Sorting:')} ${bdd.field('lastMessageAt')} (-1 Descending)
${bdd.label('• Aggregated Flags:')} ${bdd.field('unreadCount')} (integer >= 0), ${bdd.field('isRead')} (boolean)

${bdd.scenario('📖 BDD SCENARIO: Stage 2.1 — Inbox Retrieval, Unread Counting & Privacy')}
Feature: Conversation Inbox Feed & Read State

${bdd.keyword('Given')} Alice has two conversations (older with Bob, newer with Charlie) and 3 unread messages from Bob
${bdd.keyword('When')} Alice sends GET /api/v1/chats
${bdd.keyword('Then')} Conversations are returned sorted with Charlie's newer chat first
${bdd.keyword('And')} Bob's conversation displays unreadCount=3 and isRead=false
${bdd.keyword('When')} Bob (sender) sends GET /api/v1/chats
${bdd.keyword('Then')} Bob sees unreadCount=0 and isRead=true
${bdd.keyword('When')} Charlie (a new user) sends GET /api/v1/chats
${bdd.keyword('Then')} Charlie receives an empty list [] without leaking Alice & Bob's private chats
`);

      // ── 1. Create Older Chat with Bob ──
      const chat1 = await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        lastMessage: 'Hey Alice, are you available?',
        lastMessageAt: new Date('2026-08-20T10:00:00Z'),
        createdBy: new Types.ObjectId(user2Id),
      });

      // Bob sends 3 unread messages to Alice
      await Message.create([
        {
          chatId: chat1._id,
          sender: new Types.ObjectId(user2Id),
          text: 'Message 1',
          readBy: [new Types.ObjectId(user2Id)], // Read by sender only
        },
        {
          chatId: chat1._id,
          sender: new Types.ObjectId(user2Id),
          text: 'Message 2',
          readBy: [new Types.ObjectId(user2Id)],
        },
        {
          chatId: chat1._id,
          sender: new Types.ObjectId(user2Id),
          text: 'Message 3',
          readBy: [new Types.ObjectId(user2Id)],
        },
      ]);

      // ── 2. Create Newer Chat with Charlie ──
      const chat2 = await Chat.create({
        conversationKey: [user1Id, user3Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user3Id)],
        lastMessage: 'Recent conversation with Charlie',
        lastMessageAt: new Date('2026-08-28T18:00:00Z'),
        createdBy: new Types.ObjectId(user1Id),
      });

      // ── 3. Alice retrieves inbox ──
      const resAlice = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/chats',
        {},
        resAlice.body,
        'BDD-02-INBOX-FEED-ALICE',
        'Alice retrieves inbox sorted by latest active chat with 3 unread messages from Bob',
      );

      assertSuccessResponse(resAlice.body);
      expect(resAlice.body.data).toHaveLength(2);
      // Newest chat first
      expect(resAlice.body.data[0].id).toBe(chat2._id.toString());
      expect(resAlice.body.data[1].id).toBe(chat1._id.toString());
      // Unread count calculated for Alice
      expect(resAlice.body.data[1].unreadCount).toBe(3);
      expect(resAlice.body.data[1].isRead).toBe(false);

      // ── 4. Bob (sender) retrieves inbox (0 unread for Bob) ──
      const resBob = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user2AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/chats',
        {},
        resBob.body,
        'BDD-02-INBOX-FEED-BOB',
        'Bob (sender) retrieves inbox with 0 unread messages (unreadCount=0, isRead=true)',
      );

      assertSuccessResponse(resBob.body);
      expect(resBob.body.data[0].unreadCount).toBe(0);
      expect(resBob.body.data[0].isRead).toBe(true);

      // ── 5. New User Charlie with 0 chats receives empty array [] ──
      // Clean up chat2 temporarily to test empty state
      await Chat.deleteOne({ _id: chat2._id });

      const resCharlie = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${user3AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/chats',
        {},
        resCharlie.body,
        'BDD-02-EMPTY-INBOX-PRIVACY',
        'Charlie receives empty array without leaking Alice and Bob private chat',
      );

      assertSuccessResponse(resCharlie.body);
      expect(resCharlie.body.data).toEqual([]);
    });

    it('BDD-02-B Universal Search: Filters inbox using ?searchTerm= across participant names, linked item titles, and message keywords', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice
I want to type search keywords in my inbox search bar
So that I can quickly find any past conversation by participant name, attached marketplace item title, or message text

${bdd.section('💡 SIMPLE EXPLANATION (Universal Multi-Field Search):')}
The ?searchTerm= query filter executes a case-insensitive regex search simultaneously across 3 key fields:
1. Participant Name: Matches contact name (e.g. ?searchTerm=Charlie).
2. Linked Marketplace Item Title: Matches attached product name (e.g. ?searchTerm=Gloves).
3. Message Snippet: Matches recent conversation contents (e.g. ?searchTerm=scheduled).

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/chats?searchTerm=...')}
${bdd.label('• Access Policy:')} ${bdd.access('Authenticated (Participants must contain caller.userId)')}
${bdd.label('• Supported Search Dimensions:')}
  - participant.name: Case-insensitive regex match on contact names
  - itemId.title: Case-insensitive regex match on linked marketplace item titles
  - lastMessage: Case-insensitive regex match on message text snippets

${bdd.scenario('📖 BDD SCENARIO: Stage 2.2 — Universal Inbox Search Filter')}
Feature: Search & Filter Inbox

${bdd.keyword('Given')} Alice has multiple conversations in her inbox
${bdd.keyword('When')} Alice sends GET /api/v1/chats?searchTerm=Charlie
${bdd.keyword('Then')} The server returns only conversations matching the search term with HTTP 200 OK
`);

      // Seed Item-linked chat
      const itemListing = await Item.create({
        title: 'Vintage Driving Gloves',
        price: 45,
        condition: ITEM_CONDITION.NEW,
        location: 'Queens Hub',
        status: ITEM_STATUS.AVAILABLE,
        createdBy: new Types.ObjectId(user2Id),
      });

      await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        itemId: itemListing._id,
        lastMessage: 'Are the gloves still available?',
        lastMessageAt: new Date('2026-08-28T12:00:00Z'),
        createdBy: new Types.ObjectId(user1Id),
      });

      // Seed Charlie conversation
      await Chat.create({
        conversationKey: [user1Id, user3Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user3Id)],
        lastMessage: 'Airport pickup scheduled for tomorrow',
        lastMessageAt: new Date('2026-08-28T14:00:00Z'),
        createdBy: new Types.ObjectId(user1Id),
      });

      // Execute search query
      const response = await request(app)
        .get('/api/v1/chats?searchTerm=Charlie')
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/chats',
        { query: { searchTerm: 'Charlie' } },
        response.body,
        'BDD-02-SEARCH-INBOX',
        'Alice searches inbox by keyword (?searchTerm=Charlie) and receives matching conversation',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].lastMessage).toContain('Airport pickup');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. GET SINGLE CHAT BY ID
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-03 GET SINGLE CHAT BY ID', () => {
    it('BDD-03-A Participant opens a specific chat room to view complete conversation details', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice
I want to open Bob's chat room directly by its chatId
So that my screen shows Bob's avatar, email, linked item card, and current unread counter

${bdd.section('💡 SIMPLE EXPLANATION:')}
GET /api/v1/chats/:chatId populates participant profiles (name, email, avatar),
attached items, jobs, and computes unreadCount specifically for Alice.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('GET')} ${bdd.endpoint('/api/v1/chats/:chatId')}
${bdd.label('• Access Policy:')} ${bdd.access('Caller must be a member of chat.participants')}
${bdd.label('• Populated Fields:')}
  - participants: name, profilePicture, email
  - itemId: title, photos, price, condition, status, location
  - jobId: jobType, pickup, dropoff, date, time, paymentAmount, status
  - supportId: subject
`);

      const item = await Item.create({
        title: 'Roof Rack Cargo Carrier',
        price: 220,
        condition: ITEM_CONDITION.USED,
        location: 'Brooklyn Depot',
        status: ITEM_STATUS.AVAILABLE,
        createdBy: new Types.ObjectId(user2Id),
      });

      const chat = await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        itemId: item._id,
        lastMessage: 'Can you do $200 for the rack?',
        lastMessageAt: new Date(),
        createdBy: new Types.ObjectId(user1Id),
      });

      // Add 1 unread message from Bob
      await Message.create({
        chatId: chat._id,
        sender: new Types.ObjectId(user2Id),
        text: 'Sure, $200 sounds fair!',
        readBy: [new Types.ObjectId(user2Id)],
      });

      const response = await request(app)
        .get(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'GET',
        '/api/v1/chats/:chatId',
        { params: { chatId: chat._id.toString() } },
        response.body,
        'BDD-03-GET-CHAT-BY-ID',
        'Alice fetches single chat room with complete details',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.id).toBe(chat._id.toString());
      expect(response.body.data.participants).toHaveLength(2);
      expect(response.body.data.participants[0]).toHaveProperty('email');
      expect(response.body.data.itemId).toBeDefined();
      expect(response.body.data.itemId.title).toBe('Roof Rack Cargo Carrier');
      expect(response.body.data.itemId.location).toBe('Brooklyn Depot');
      expect(response.body.data.unreadCount).toBe(1);
      expect(response.body.data.isRead).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. DELETE CHAT & CASCADING MESSAGE PURGE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('BDD-04 DELETE CHAT & CASCADING MESSAGE PURGE', () => {
    it('BDD-04-A Participant deletes a chat room, completely cleaning up all messages inside it', async () => {
      console.info(`
${bdd.header('📝 USER STORY:')}
As Alice
I want to delete a completed conversation thread
So that it is removed from my inbox and all old messages in that room are permanently erased

${bdd.section('💡 SIMPLE EXPLANATION:')}
When Alice deletes a chat, the backend automatically runs a cascading clean-up:
1. Deletes all message documents linked to that chatId from the Message collection.
2. Deletes the chat room document from the Chat collection.

${bdd.section('📋 BUSINESS RULES & QUERY PAYLOAD SPECIFICATIONS:')}
${bdd.label('• Primary Endpoint:')} ${bdd.method('DELETE')} ${bdd.endpoint('/api/v1/chats/:chatId')}
${bdd.label('• Access Policy:')} ${bdd.access('Caller must be a member of chat.participants')}
${bdd.label('• Cascading Deletion Rationale:')}
  - Purges all Message collection documents matching { chatId }.
  - Purges the Chat collection record.

${bdd.scenario('📖 BDD SCENARIO: Stage 4.1 — Cascading Chat Deletion')}
Feature: Conversation Purge & Message Clean-up

Given an active chat room with 3 messages stored in MongoDB
When Alice sends DELETE /api/v1/chats/:chatId
Then The server returns HTTP 200 OK with { deleted: true }
And All 3 messages are purged from the database
And The chat room no longer exists in the database
`);

      const chat = await Chat.create({
        conversationKey: [user1Id, user2Id].sort().join('_'),
        participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        lastMessage: 'Farewell message',
        lastMessageAt: new Date(),
        createdBy: new Types.ObjectId(user1Id),
      });

      // Create 3 messages
      await Message.create([
        {
          chatId: chat._id,
          sender: new Types.ObjectId(user1Id),
          text: 'Message 1',
        },
        {
          chatId: chat._id,
          sender: new Types.ObjectId(user2Id),
          text: 'Message 2',
        },
        {
          chatId: chat._id,
          sender: new Types.ObjectId(user1Id),
          text: 'Message 3',
        },
      ]);

      const response = await request(app)
        .delete(`/api/v1/chats/${chat._id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .expect(StatusCodes.OK);

      logApi(
        'DELETE',
        '/api/v1/chats/:chatId',
        { params: { chatId: chat._id.toString() } },
        response.body,
        'BDD-04-DELETE-CHAT',
        'Alice permanently deletes chat room and cascades message cleanup',
      );

      assertSuccessResponse(response.body);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.data.id).toBe(chat._id.toString());

      // Verify chat document is gone
      const checkChat = await Chat.findById(chat._id);
      expect(checkChat).toBeNull();

      // Verify messages are cascade purged
      const remainingMessages = await Message.countDocuments({
        chatId: chat._id,
      });
      expect(remainingMessages).toBe(0);
    });
  });
});
