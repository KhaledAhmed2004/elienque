import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import CursorQueryBuilder from '../CursorQueryBuilder';
import ApiError from '../../../errors/ApiError';

function createMockQuery(initialDocs: any[] = []) {
  const filterState: any[] = [];
  const queryOps: Record<string, any> = {
    sort: null,
    limit: null,
    select: null,
    populate: [],
  };

  const mockQuery: any = {
    and: vi.fn((conditions: any[]) => {
      filterState.push(...conditions);
      return mockQuery;
    }),
    sort: vi.fn((sortSpec: any) => {
      queryOps.sort = sortSpec;
      return mockQuery;
    }),
    limit: vi.fn((limitVal: number) => {
      queryOps.limit = limitVal;
      return mockQuery;
    }),
    select: vi.fn((fieldsVal: string) => {
      queryOps.select = fieldsVal;
      return mockQuery;
    }),
    populate: vi.fn((popVal: any) => {
      queryOps.populate.push(popVal);
      return mockQuery;
    }),
    lean: vi.fn().mockReturnValue({
      exec: vi.fn(async () => initialDocs),
    }),
  };
  return { mockQuery, filterState, queryOps };
}

describe('Feature: Enterprise CursorQueryBuilder Unit Tests', () => {
  // ==========================================
  // RULE 1: NUMERIC RANGE FILTERING (.range)
  // ==========================================
  describe('Rule 1: Numeric Range Filtering (.range)', () => {
    it('applies $gte and $lte when min and max query params are provided', () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, {
        minPrice: '100',
        maxPrice: '500',
      });

      qb.range('price', 'minPrice', 'maxPrice');

      const extraConditions = (qb as any).extraConditions;
      expect(extraConditions).toHaveLength(1);
      expect(extraConditions[0]).toEqual({
        price: { $gte: 100, $lte: 500 },
      });
    });

    it('safely handles empty strings and NaN without creating invalid filters', () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, {
        minPrice: '',
        maxPrice: 'invalid-num',
      });

      qb.range('price', 'minPrice', 'maxPrice');

      const extraConditions = (qb as any).extraConditions;
      expect(extraConditions).toHaveLength(0);
    });

    it('applies default capitalized key names if min/max keys omitted', () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, {
        minSalary: '5000',
      });

      qb.range('salary');

      const extraConditions = (qb as any).extraConditions;
      expect(extraConditions).toHaveLength(1);
      expect(extraConditions[0]).toEqual({
        salary: { $gte: 5000 },
      });
    });
  });

  // ==========================================
  // RULE 2: CUSTOM FILTER SANITIZATION (.filter)
  // ==========================================
  describe('Rule 2: Custom Filter Sanitization (.filter)', () => {
    it('prunes undefined, empty strings, and prototype pollution keys', () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, {});

      qb.filter({
        condition: 'Used',
        emptyField: '',
        missingField: undefined,
        __proto__: 'malicious',
      } as any);

      const extraConditions = (qb as any).extraConditions;
      expect(extraConditions).toHaveLength(1);
      expect(extraConditions[0]).toEqual({
        condition: 'Used',
      });
    });
  });

  // ==========================================
  // RULE 3: CURSOR EXECUTION & LOOKAHEAD SLICING (13-Point Matrix)
  // ==========================================
  describe('Rule 3: Cursor Pagination, Lookahead & Token Integrity', () => {
    it('1. Scenario: Given first page request without cursor, When executed, Then returns first slice and valid nextCursor', async () => {
      const id1 = new Types.ObjectId().toString();
      const id2 = new Types.ObjectId().toString();
      const id3 = new Types.ObjectId().toString();
      const mockDocs = [
        { _id: id1, name: 'Item 1' },
        { _id: id2, name: 'Item 2' },
        { _id: id3, name: 'Item 3' },
      ];

      // Limit 2 requested, DB returns 3 (lookahead limit + 1)
      const { mockQuery, queryOps } = createMockQuery(mockDocs);
      const qb = new CursorQueryBuilder<any>(mockQuery, { limit: '2' });
      const result = await qb.execute();

      expect(queryOps.limit).toBe(3); // limit + 1
      expect(result.data).toHaveLength(2);
      expect(result.cursor.hasMore).toBe(true);
      expect(result.cursor.limit).toBe(2);
      expect(result.cursor.nextCursor).toBeDefined();

      const decoded = JSON.parse(Buffer.from(result.cursor.nextCursor!, 'base64url').toString('utf8'));
      expect(decoded._id).toBe(id2);
    });

    it('2. Scenario: Given valid nextCursor token, When subsequent page is queried, Then adds correct cursor comparison filter', async () => {
      const cursorId = new Types.ObjectId().toString();
      const cursorToken = Buffer.from(JSON.stringify({ _id: cursorId })).toString('base64url');

      const { mockQuery, filterState } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(mockQuery, { cursor: cursorToken });
      await qb.execute();

      expect(filterState).toHaveLength(1);
      expect(filterState[0]).toEqual({
        _id: { $gt: new Types.ObjectId(cursorId) },
      });
    });

    it('3. Scenario: Given invalid/corrupt base64 cursor token, When executed, Then throws ApiError with status 400', async () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, { cursor: 'invalid-not-base64-json' });

      await expect(qb.execute()).rejects.toThrow(ApiError);
      try {
        await qb.execute();
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('Invalid cursor token');
      }
    });

    it('4. Scenario: Given tampered cursor token with malformed ObjectId, When executed, Then throws ApiError with status 400', async () => {
      const tamperedToken = Buffer.from(JSON.stringify({ _id: 'not-an-objectid-123' })).toString('base64url');
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, { cursor: tamperedToken });

      await expect(qb.execute()).rejects.toThrow(ApiError);
      try {
        await qb.execute();
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('Invalid cursor token');
      }
    });

    it('5. Scenario: Given DB returns exactly limit documents, When executed, Then hasMore is false and nextCursor is null', async () => {
      const id1 = new Types.ObjectId().toString();
      const id2 = new Types.ObjectId().toString();
      const mockDocs = [
        { _id: id1, name: 'Item 1' },
        { _id: id2, name: 'Item 2' },
      ];

      // Limit 2 requested, DB returns exactly 2
      const { mockQuery } = createMockQuery(mockDocs);
      const qb = new CursorQueryBuilder<any>(mockQuery, { limit: '2' });
      const result = await qb.execute();

      expect(result.data).toHaveLength(2);
      expect(result.cursor.hasMore).toBe(false);
      expect(result.cursor.nextCursor).toBeNull();
    });

    it('6. Scenario: Given empty dataset (0 results), When executed, Then data is empty and nextCursor is null', async () => {
      const { mockQuery } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(mockQuery, { limit: '10' });
      const result = await qb.execute();

      expect(result.data).toHaveLength(0);
      expect(result.cursor.hasMore).toBe(false);
      expect(result.cursor.nextCursor).toBeNull();
    });

    it('7. Scenario: Given order desc, When cursor query executes, Then sort is descending and op is $lt', async () => {
      const cursorId = new Types.ObjectId().toString();
      const cursorToken = Buffer.from(JSON.stringify({ _id: cursorId })).toString('base64url');

      const { mockQuery, filterState, queryOps } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(mockQuery, { cursor: cursorToken }, { order: 'desc' });
      await qb.execute();

      expect(queryOps.sort).toEqual({ _id: -1 });
      expect(filterState[0]).toEqual({
        _id: { $lt: new Types.ObjectId(cursorId) },
      });
    });

    it('8. Scenario: Given custom cursorField (createdAt), When executed, Then compound cursor filter and sort are generated', async () => {
      const cursorId = new Types.ObjectId().toString();
      const createdAt = '2026-09-07T12:00:00.000Z';
      const cursorToken = Buffer.from(JSON.stringify({ _id: cursorId, createdAt })).toString('base64url');

      const { mockQuery, filterState, queryOps } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(
        mockQuery,
        { cursor: cursorToken },
        { cursorField: 'createdAt', order: 'asc' },
      );
      await qb.execute();

      expect(queryOps.sort).toEqual({ createdAt: 1, _id: 1 });
      expect(filterState[0]).toEqual({
        $or: [
          { createdAt: { $gt: createdAt } },
          { createdAt, _id: { $gt: new Types.ObjectId(cursorId) } },
        ],
      });
    });

    it('9. Scenario: Given custom cursorField with missing cursorField value in token, When executed, Then rejects with 400', async () => {
      const cursorId = new Types.ObjectId().toString();
      // Token only has _id, but cursorField is 'createdAt'
      const invalidToken = Buffer.from(JSON.stringify({ _id: cursorId })).toString('base64url');

      const { mockQuery } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(
        mockQuery,
        { cursor: invalidToken },
        { cursorField: 'createdAt' },
      );

      await expect(qb.execute()).rejects.toThrow(ApiError);
    });

    it('10. Scenario: Given custom projection excluding cursorField (select name), When executed, Then internal query retrieves cursorField and nextCursor generates safely without leaking into response', async () => {
      const id1 = new Types.ObjectId().toString();
      const id2 = new Types.ObjectId().toString();
      const mockDocs = [
        { _id: id1, name: 'Item 1', createdAt: '2026-09-07T10:00:00.000Z' },
        { _id: id2, name: 'Item 2', createdAt: '2026-09-07T11:00:00.000Z' },
      ];

      const { mockQuery, queryOps } = createMockQuery(mockDocs);
      const qb = new CursorQueryBuilder<any>(
        mockQuery,
        { limit: '1' },
        { cursorField: 'createdAt' },
      );
      qb.select('name'); // Caller only requested name
      const result = await qb.execute();

      // Query sent to Mongo should internally request createdAt
      expect(queryOps.select).toContain('createdAt');
      expect(result.data).toHaveLength(1);
      // External response must NOT leak createdAt since caller only requested 'name'
      expect(result.data[0]).not.toHaveProperty('createdAt');
      expect(result.data[0]).toHaveProperty('name', 'Item 1');
      // nextCursor must still be validly constructed from the internal createdAt
      expect(result.cursor.nextCursor).toBeDefined();
      const decoded = JSON.parse(Buffer.from(result.cursor.nextCursor!, 'base64url').toString('utf8'));
      expect(decoded.createdAt).toBe('2026-09-07T10:00:00.000Z');
    });

    it('11. Scenario: Given explicit exclusion of _id (select -_id name), When executed, Then nextCursor is generated but _id is stripped from response', async () => {
      const id1 = new Types.ObjectId().toString();
      const id2 = new Types.ObjectId().toString();
      const mockDocs = [
        { _id: id1, name: 'Item 1' },
        { _id: id2, name: 'Item 2' },
      ];

      const { mockQuery, queryOps } = createMockQuery(mockDocs);
      const qb = new CursorQueryBuilder<any>(mockQuery, { limit: '1' });
      qb.select('-_id name'); // Caller explicitly excludes _id
      const result = await qb.execute();

      // Internal query omits -_id so Mongo returns _id for cursor generation
      expect(queryOps.select).not.toContain('-_id');
      expect(result.data).toHaveLength(1);
      // Response must NOT contain _id
      expect(result.data[0]).not.toHaveProperty('_id');
      expect(result.data[0]).toHaveProperty('name', 'Item 1');
      // nextCursor must still be valid
      expect(result.cursor.nextCursor).toBeDefined();
    });

    it('12. Scenario: Given fractional limit (limit=3.7), When constructor initializes, Then limit is floored to integer 3', () => {
      const { mockQuery } = createMockQuery();
      const qb = new CursorQueryBuilder<any>(mockQuery, { limit: '3.7' });
      expect((qb as any).limit).toBe(3);
    });

    it('13. Scenario: Given combined search, range, and cursor filters, When executed, Then all conditions are chained into $and', async () => {
      const { mockQuery, filterState } = createMockQuery([]);
      const qb = new CursorQueryBuilder<any>(mockQuery, {
        searchTerm: 'Enterprise',
        minPrice: '50',
      });

      qb.search(['title', 'description']).range('price');
      await qb.execute();

      expect(filterState).toHaveLength(2);
      // Search condition
      expect(filterState[0]).toHaveProperty('$or');
      // Range condition
      expect(filterState[1]).toHaveProperty('price');
    });
  });
});
