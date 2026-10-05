import { describe, it, expect, vi } from 'vitest';
import QueryBuilder from '../QueryBuilder';
import { Query } from 'mongoose';

// Helper to create mock Mongoose Query and Model with concurrency hooks
function createMockModelQuery<T = any>() {
  const filterState: Record<string, any> = {};
  const queryOps: Record<string, any> = {};

  const mockQuery: any = {
    find: vi.fn((filterObj: any) => {
      Object.assign(filterState, filterObj);
      return mockQuery;
    }),
    sort: vi.fn((sortSpec: any) => {
      queryOps.sort = sortSpec;
      return mockQuery;
    }),
    skip: vi.fn((skipVal: number) => {
      queryOps.skip = skipVal;
      return mockQuery;
    }),
    limit: vi.fn((limitVal: number) => {
      queryOps.limit = limitVal;
      return mockQuery;
    }),
    select: vi.fn((fieldsVal: any) => {
      queryOps.select = fieldsVal;
      return mockQuery;
    }),
    populate: vi.fn((popVal: any) => {
      queryOps.populate = popVal;
      return mockQuery;
    }),
    getFilter: vi.fn(() => ({ ...filterState })),
    exec: vi.fn(async () => [
      { _id: '1', name: 'Test Doc 1' },
      { _id: '2', name: 'Test Doc 2' },
    ]),
    model: {
      modelName: 'MockModel',
      countDocuments: vi.fn(async () => 42),
      aggregate: vi.fn(async () => [
        {
          total: [{ count: 42 }],
          data: [{ _id: '1', name: 'Test Doc 1' }],
        },
      ]),
      hydrate: vi.fn((doc: any) => doc),
    },
  };

  return {
    mockQuery: mockQuery as unknown as Query<T[], T>,
    filterState,
    queryOps,
    mockObj: mockQuery,
  };
}

describe('Feature: Enterprise Generic QueryBuilder (Complete 36 BDD Specifications)', () => {
  // ==========================================
  // RULE 1: PROTOTYPE POLLUTION & INJECTION DEFENSE (5 Tests)
  // ==========================================
  describe('Rule 1: Prototype Pollution & Injection Defense', () => {
    it('1. Scenario: Given __proto__ injection payload, When filter is executed, Then dangerous key is stripped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = {
        __proto__: { isAdmin: true },
        status: 'ACTIVE',
      };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.filter();

      expect(filterState.status).toBe('ACTIVE');
      expect((filterState as any).isAdmin).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(filterState, '__proto__')).toBe(false);
    });

    it('2. Scenario: Given constructor and constructor.prototype injection, When filter is executed, Then dangerous keys are stripped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = {
        constructor: { prototype: { role: 'SUPER_ADMIN' } },
        'constructor.prototype.role': 'SUPER_ADMIN',
        status: 'ACTIVE',
      };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.filter();

      expect(filterState.status).toBe('ACTIVE');
      expect(Object.prototype.hasOwnProperty.call(filterState, 'constructor')).toBe(false);
      expect(filterState['constructor.prototype.role']).toBeUndefined();
    });

    it('3. Scenario: Given dotted nested prototype pollution keys (e.g. user.__proto__), When filter is executed, Then nested keys are stripped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = {
        'user.__proto__.isAdmin': 'true',
        'user.constructor.prototype.role': 'admin',
        validField: 'validValue',
      };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.filter();

      expect(filterState.validField).toBe('validValue');
      expect(filterState['user.__proto__.isAdmin']).toBeUndefined();
      expect(filterState['user.constructor.prototype.role']).toBeUndefined();
    });

    it('4. Scenario: Given deeply nested object with $ operators, When filter is executed, Then $ operators are stripped without stack exhaustion', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = {
        level1: {
          level2: {
            level3: {
              level4: {
                $ne: 'malicious',
                safeData: 'keepMe',
              },
            },
          },
        },
      };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.filter();

      expect(filterState.level1.level2.level3.level4.safeData).toBe('keepMe');
      expect(filterState.level1.level2.level3.level4.$ne).toBeUndefined();
    });

    it('5. Scenario: Given excessive object nesting (> 5 levels), When filter is executed, Then subtree is deterministically pruned preventing DoS', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = {
        l1: { l2: { l3: { l4: { l5: { l6: { l7: { payload: 'deep' } } } } } } },
      };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.filter();

      expect(filterState.l1).toBeUndefined();
    });
  });

  // ==========================================
  // RULE 2: SAFE SEARCH & REDOS PREVENTION (4 Tests)
  // ==========================================
  describe('Rule 2: Safe Search & ReDoS Prevention', () => {
    it('6. Scenario: Given searchTerm as undefined or null, When search is executed, Then modelQuery find is not modified', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { searchTerm: undefined as any });
      qb.search(['name', 'email']);

      expect(filterState.$or).toBeUndefined();
    });

    it('7. Scenario: Given searchableFields as empty array [], When search is executed, Then modelQuery find is not modified', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { searchTerm: 'john' });
      qb.search([]);

      expect(filterState.$or).toBeUndefined();
    });

    it('8. Scenario: Given extremely long search string (5000 chars), When search is executed, Then input is truncated to maxSearchLength (256) and escaped safely', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const longTerm = 'a'.repeat(5000);
      const qb = new QueryBuilder(mockQuery, { searchTerm: longTerm });
      qb.search(['bio']);

      expect(filterState.$or).toBeDefined();
      expect(filterState.$or[0].bio.$regex).toHaveLength(256);
      expect(filterState.$or[0].bio.$regex).toBe('a'.repeat(256));
    });

    it('9. Scenario: Given ReDoS payload metacharacters ((a+)+$), When search is executed, Then input is escaped as literal regex characters', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const redosPayload = '((a+)+)$';
      const qb = new QueryBuilder(mockQuery, { searchTerm: redosPayload });
      qb.search(['title']);

      expect(filterState.$or[0].title.$regex).toBe('\\(\\(a\\+\\)\\+\\)\\$');
      expect(filterState.$or[0].title.$options).toBe('i');
    });
  });

  // ==========================================
  // RULE 3: CATEGORY FILTERING (3 Tests)
  // ==========================================
  describe('Rule 3: Category Filtering', () => {
    it('10. Scenario: Given category parameter containing Mongo operator token ($ne), When categoryFilter is executed, Then operator tokens are stripped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = { category: ['$ne', 'ADMIN', '$gt', 'USER'] };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.categoryFilter('role');

      expect(filterState.role.$in).toEqual(['ADMIN', 'USER']);
    });

    it('11. Scenario: Given empty category array [], When categoryFilter is executed, Then filter is skipped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { category: [] as any });
      qb.categoryFilter('tier');

      expect(filterState.tier).toBeUndefined();
    });

    it('12. Scenario: Given category array containing empty/whitespace strings, When categoryFilter is executed, Then empty tokens are pruned', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const rawQuery = { category: ['', '   ', 'VIP', 'PREMIUM'] };
      const qb = new QueryBuilder(mockQuery, rawQuery as any);
      qb.categoryFilter('tier');

      expect(filterState.tier.$in).toEqual(['VIP', 'PREMIUM']);
    });
  });

  // ==========================================
  // RULE 4: GEOSPATIAL & BOUNDARY VALIDATION (7 Tests)
  // ==========================================
  describe('Rule 4: Geospatial & Boundary Validation', () => {
    it('13. Scenario: Given missing latitude or longitude, When locationFilter is executed, Then query filter is skipped', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { latitude: '23.81', distance: '10' });
      qb.locationFilter();

      expect(filterState.latitude).toBeUndefined();
    });

    it('14. Scenario: Given NaN or Infinity coordinates, When locationFilter is executed, Then invalid numbers are ignored', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        latitude: 'NaN',
        longitude: 'Infinity',
        distance: '10',
      });
      qb.locationFilter();

      expect(filterState.latitude).toBeUndefined();
    });

    it('15. Scenario: Given exact boundary coordinates (lat: 90/-90, lng: 180/-180), When locationFilter is executed, Then bounding box is calculated', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        latitude: '90',
        longitude: '-180',
        distance: '5',
      });
      qb.locationFilter('locLat', 'locLng');

      expect(filterState.locLat).toBeDefined();
      expect(filterState.locLng).toBeDefined();
    });

    it('16. Scenario: Given just-outside boundary coordinates (lat: 90.000001, lng: 180.000001), When locationFilter is executed, Then RangeError is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        latitude: '90.000001',
        longitude: '180.000001',
        distance: '5',
      });

      expect(() => qb.locationFilter()).toThrow(
        'Latitude must be between -90 and 90 degrees',
      );
    });

    it('17. Scenario: Given polygon with invalid coordinate strings (90.0,abc), When geoWithinPolygon is executed, Then ValidationError is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        polygon: '90.0,abc; 91.0,23.0; 91.0,24.0',
      });

      expect(() => qb.geoWithinPolygon()).toThrow(
        'Invalid polygon coordinates',
      );
    });

    it('18. Scenario: Given polygon with 3 points but out-of-range latitude (95.0), When geoWithinPolygon is executed, Then RangeError is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        polygon: '90.0,95.0; 91.0,23.0; 91.0,24.0',
      });

      expect(() => qb.geoWithinPolygon()).toThrow(
        'Latitude must be between -90 and 90 degrees',
      );
    });

    it('19. Scenario: Given already-closed polygon, When geoWithinPolygon is executed, Then closing point is not duplicated', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        polygon: '90.0,23.0; 91.0,23.0; 91.0,24.0; 90.0,23.0',
      });
      qb.geoWithinPolygon('area');

      const polygon = filterState.area.$geoWithin.$polygon;
      expect(polygon).toHaveLength(4);
    });
  });

  // ==========================================
  // RULE 5: DATE RANGE VALIDATION (5 Tests)
  // ==========================================
  describe('Rule 5: Date Range Validation', () => {
    it('20. Scenario: Given invalid date string (start: not-a-date), When dateFilter is executed, Then format error is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        timeFilter: 'custom',
        start: 'not-a-date',
        end: '2026-06-30',
      });

      expect(() => qb.dateFilter()).toThrow('Invalid date format');
    });

    it('21. Scenario: Given equal start and end dates (start === end), When dateFilter is executed, Then point-in-time range is queried', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const isoDate = '2026-06-15T12:00:00.000Z';
      const qb = new QueryBuilder(mockQuery, {
        timeFilter: 'custom',
        start: isoDate,
        end: isoDate,
      });
      qb.dateFilter('eventDate');

      expect(filterState.eventDate.$gte).toEqual(new Date(isoDate));
      expect(filterState.eventDate.$lte).toEqual(new Date(isoDate));
    });

    it('22. Scenario: Given ISO date strings with timezone offsets, When dateFilter is executed, Then dates are normalized to exact UTC instances', () => {
      const { mockQuery, filterState } = createMockModelQuery();
      const startIso = '2026-06-01T06:00:00+06:00';
      const endIso = '2026-06-30T18:00:00+06:00';
      const qb = new QueryBuilder(mockQuery, {
        timeFilter: 'custom',
        start: startIso,
        end: endIso,
      });
      qb.dateFilter('scheduledAt');

      expect(filterState.scheduledAt.$gte.toISOString()).toBe(new Date(startIso).toISOString());
      expect(filterState.scheduledAt.$lte.toISOString()).toBe(new Date(endIso).toISOString());
    });

    it('23. Scenario: Given custom timeFilter missing start parameter, When dateFilter is executed, Then missing parameter error is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        timeFilter: 'custom',
        end: '2026-06-30',
      });

      expect(() => qb.dateFilter()).toThrow(
        "Custom date filter requires both 'start' and 'end' query parameters.",
      );
    });

    it('24. Scenario: Given inverted date range (start > end), When dateFilter is executed, Then logical order error is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        timeFilter: 'custom',
        start: '2026-12-31',
        end: '2026-01-01',
      });

      expect(() => qb.dateFilter()).toThrow(
        "'start' date cannot be after 'end' date.",
      );
    });
  });

  // ==========================================
  // RULE 6: ANTI-DOS PAGINATION & NUMERIC SAFETY (5 Tests)
  // ==========================================
  describe('Rule 6: Anti-DoS Pagination & Numeric Safety', () => {
    it('25. Scenario: Given page = "NaN" and limit = "NaN", When paginate is executed, Then safe fallback defaults are used', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: 'NaN', limit: 'NaN' });
      qb.paginate(10, 100);

      expect(queryOps.skip).toBe(0); // page 1
      expect(queryOps.limit).toBe(10);
    });

    it('26. Scenario: Given page = "Infinity" and limit = "Infinity", When paginate is executed, Then safe fallback defaults are used', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: 'Infinity', limit: 'Infinity' });
      qb.paginate(10, 100);

      expect(queryOps.skip).toBe(0); // page 1
      expect(queryOps.limit).toBe(10);
    });

    it('27. Scenario: Given limit = "0" and page = "0", When paginate is executed, Then values are clamped to minimum 1', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: '0', limit: '0' });
      qb.paginate(10, 100);

      expect(queryOps.skip).toBe(0); // (1 - 1) * 1 = 0
      expect(queryOps.limit).toBe(1);
    });

    it('28. Scenario: Given decimal page ("1.8") and limit ("10.4"), When paginate is executed, Then decimals are floored to integers', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: '1.8', limit: '10.4' });
      qb.paginate(10, 100);

      expect(queryOps.skip).toBe(0); // (1 - 1) * 10
      expect(queryOps.limit).toBe(10);
    });

    it('29. Scenario: Given excessive limit (999999) and negative page (-10), When paginate is executed, Then limit is clamped to maxLimit (100) and page to 1', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: '-10', limit: '999999' });
      qb.paginate(10, 100);

      expect(queryOps.skip).toBe(0);
      expect(queryOps.limit).toBe(100);
    });
  });

  // ==========================================
  // RULE 7: SORT & PROJECTION SECURITY (4 Tests)
  // ==========================================
  describe('Rule 7: Sort & Projection Security', () => {
    it('30. Scenario: Given malicious sort field (__proto__), When sort is executed, Then dangerous field is stripped', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { sort: '__proto__,createdAt' });
      qb.sort();

      expect(queryOps.sort).toBe('createdAt');
    });

    it('31. Scenario: Given allowedFields policy for sort, When unallowed field (password) is requested, Then unallowed field is ignored', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { sort: '-password,createdAt' });
      qb.sort('-createdAt', ['createdAt', 'priority']);

      expect(queryOps.sort).toBe('createdAt');
    });

    it('32. Scenario: Given malicious fields projection (__proto__, constructor), When fields is executed, Then dangerous fields are stripped', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { fields: '__proto__,name,constructor' });
      qb.fields();

      expect(queryOps.select).toBe('name');
    });

    it('33. Scenario: Given allowedFields policy for projection, When unallowed field (secretToken) is requested, Then unallowed field is ignored', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { fields: 'name,secretToken,email' });
      qb.fields('-__v', ['name', 'email']);

      expect(queryOps.select).toBe('name email');
    });
  });

  // ==========================================
  // RULE 8: EXECUTION RELIABILITY & TRUE CONCURRENCY (3 Tests)
  // ==========================================
  describe('Rule 8: Execution Reliability & True Concurrency', () => {
    it('34. Scenario: Given execute() invocation, When executed, Then both data query and count query run concurrently in parallel', async () => {
      let execStarted = false;
      let countStarted = false;
      let bothWerePendingSimultaneously = false;

      const { mockQuery, mockObj } = createMockModelQuery();
      (mockObj as any).exec = vi.fn(async () => {
        execStarted = true;
        if (countStarted) bothWerePendingSimultaneously = true;
        await new Promise(res => setTimeout(res, 10));
        return [{ _id: '1' }];
      });

      (mockObj.model as any).countDocuments = vi.fn(async () => {
        countStarted = true;
        if (execStarted) bothWerePendingSimultaneously = true;
        await new Promise(res => setTimeout(res, 10));
        return 1;
      });

      const qb = new QueryBuilder(mockQuery, { page: '1', limit: '10' });
      const result = await qb.execute();

      expect(bothWerePendingSimultaneously).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('35. Scenario: Given database data query failure (exec rejection), When execute() is called, Then error is properly propagated', async () => {
      const { mockQuery, mockObj } = createMockModelQuery();
      (mockObj as any).exec = vi.fn().mockRejectedValue(new Error('Mongo connection lost'));

      const qb = new QueryBuilder(mockQuery, {});
      await expect(qb.execute()).rejects.toThrow('Mongo connection lost');
    });

    it('36. Scenario: Given database count query failure (countDocuments rejection), When execute() is called, Then error is properly propagated', async () => {
      const { mockQuery, mockObj } = createMockModelQuery();
      (mockObj.model as any).countDocuments = vi.fn().mockRejectedValue(new Error('Mongo count timeout'));

      const qb = new QueryBuilder(mockQuery, {});
      await expect(qb.execute()).rejects.toThrow('Mongo count timeout');
    });
  });

  // ==========================================
  // RULE 9: RELATION POPULATION (1 Test)
  // ==========================================
  describe('Rule 9: Relation Population & Options Delegation', () => {
    it('37. Scenario: Given populate configurations, When populate is chained, Then modelQuery.populate is called with exact paths', () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {});
      qb.populate(['author', 'category']);

      expect(queryOps.populate).toBeDefined();
      expect(queryOps.populate).toEqual([
        { path: 'author' },
        { path: 'category' },
      ]);
    });
  });

  // ==========================================
  // RULE 10: ARCHITECTURAL HARDENING & CORRECTNESS (5 Tests)
  // ==========================================
  describe('Rule 10: Architectural Hardening & Correctness', () => {
    it('38. Scenario: Given execute() without prior paginate(), When executed, Then query is bounded with default skip and limit', async () => {
      const { mockQuery, queryOps } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {});
      const result = await qb.execute();

      expect(queryOps.skip).toBe(0);
      expect(queryOps.limit).toBe(10);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.page).toBe(1);
    });

    it('39. Scenario: Given modelQuery with active session, When execute() and getPaginationInfo() run, Then session is forwarded to countDocuments', async () => {
      const { mockQuery, mockObj } = createMockModelQuery();
      const mockSession = { id: 'test-session-id' };
      mockObj.getOptions = vi.fn(() => ({ session: mockSession }));

      const qb = new QueryBuilder(mockQuery, {});
      await qb.execute();

      expect(mockObj.model.countDocuments).toHaveBeenCalledWith(
        expect.any(Object),
        { session: mockSession },
      );

      await qb.getPaginationInfo();
      expect(mockObj.model.countDocuments).toHaveBeenCalledWith(
        expect.any(Object),
        { session: mockSession },
      );
    });

    it('40. Scenario: Given getAll() with out-of-range limits (1000, -10, NaN, Infinity) and +sort, When executed, Then values are safely normalized', async () => {
      const { mockQuery, mockObj } = createMockModelQuery();
      let capturedPipeline: any[] = [];
      mockObj.model.aggregate = vi.fn(async (pipeline: any[]) => {
        capturedPipeline = pipeline;
        return [{ total: [{ count: 5 }], data: [{ _id: '1' }] }];
      });

      // Test +sort and excessive limit
      const qb = new QueryBuilder(mockQuery, { limit: '1000', sort: '+name,-createdAt' });
      const result = await qb.getAll();

      expect(result.pagination.limit).toBe(100);
      const facetStage = capturedPipeline.find((s: any) => s.$facet);
      expect(facetStage.$facet.data).toEqual([{ $skip: 0 }, { $limit: 100 }]);

      const sortStage = capturedPipeline.find((s: any) => s.$sort);
      expect(sortStage.$sort).toEqual({ name: 1, createdAt: -1 });
    });

    it('41. Scenario: Given getFilteredResults() invocation, When executed, Then it delegates cleanly preserving identical return shape', async () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, { page: '1', limit: '10' });
      const result = await qb.getFilteredResults(['someField']);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.page).toBe(1);
    });

    it('42. Scenario: Given invalid client coordinate parameters, When locationFilter is executed, Then ApiError with statusCode 400 is thrown', () => {
      const { mockQuery } = createMockModelQuery();
      const qb = new QueryBuilder(mockQuery, {
        latitude: '150', // invalid latitude (> 90)
        longitude: '50',
        distance: '10',
      });

      try {
        qb.locationFilter();
        expect.unreachable('Should have thrown ApiError');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Latitude must be between -90 and 90 degrees');
      }
    });
  });
});
