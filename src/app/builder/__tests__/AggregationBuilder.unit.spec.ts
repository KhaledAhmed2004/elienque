import { describe, it, expect, vi } from 'vitest';
import AggregationBuilder, { summarizePipeline } from '../AggregationBuilder';
import { Model } from 'mongoose';

// Helper to create mock Mongoose Model
function createMockModel(modelName: string = 'User') {
  const mockAggregate = vi.fn(async (pipeline: any[]) => [
    { _id: 'admin', count: 12 },
    { _id: 'user', count: 45 },
  ]);

  const mockModel: any = {
    modelName,
    aggregate: mockAggregate,
  };

  return { mockModel: mockModel as unknown as Model<any>, mockAggregate, rawMock: mockModel };
}

describe('Feature: Enterprise Fluent AggregationBuilder (BDD Specifications)', () => {
  // ==========================================
  // RULE 1: FLUENT MULTI-STAGE PIPELINE CONSTRUCTION (3 Tests)
  // ==========================================
  describe('Rule 1: Fluent Multi-Stage Pipeline Construction', () => {
    it('1. Scenario: Given multiple aggregation stages chained fluently, When pipeline is retrieved, Then all stages should be correctly structured in sequence', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);

      const pipeline = builder
        .match({ status: 'ACTIVE' })
        .lookup({
          from: 'roles',
          localField: 'roleId',
          foreignField: '_id',
          as: 'roleInfo',
        })
        .unwind('$roleInfo')
        .addFields({ totalScore: { $add: ['$score', 10] } })
        .group({ _id: '$roleInfo.name', count: { $sum: 1 } })
        .sort({ count: -1 })
        .skip(10)
        .limit(5)
        .project({ _id: 1, count: 1 })
        .getPipeline();

      expect(pipeline).toHaveLength(9);
      expect(pipeline[0]).toEqual({ $match: { status: 'ACTIVE' } });
      expect(pipeline[1]).toEqual({
        $lookup: {
          from: 'roles',
          localField: 'roleId',
          foreignField: '_id',
          as: 'roleInfo',
        },
      });
      expect(pipeline[2]).toEqual({ $unwind: '$roleInfo' });
      expect(pipeline[3]).toEqual({
        $addFields: { totalScore: { $add: ['$score', 10] } },
      });
      expect(pipeline[4]).toEqual({
        $group: { _id: '$roleInfo.name', count: { $sum: 1 } },
      });
      expect(pipeline[5]).toEqual({ $sort: { count: -1 } });
      expect(pipeline[6]).toEqual({ $skip: 10 });
      expect(pipeline[7]).toEqual({ $limit: 5 });
      expect(pipeline[8]).toEqual({ $project: { _id: 1, count: 1 } });
    });

    it('2. Scenario: Given advanced stages ($facet, $count, $addStage), When stages are added, Then pipeline should contain corresponding aggregation stages', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);

      builder
        .facet({
          metadata: [{ $count: 'total' }],
          data: [{ $skip: 0 }, { $limit: 10 }],
        })
        .count('totalResults')
        .addStage({ $sample: { size: 3 } });

      const pipeline = builder.getPipeline();

      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toHaveProperty('$facet');
      expect(pipeline[1]).toEqual({ $count: 'totalResults' });
      expect(pipeline[2]).toEqual({ $sample: { size: 3 } });
    });

    it('3. Scenario: Given built pipeline, When reset is called, Then all pipeline stages should be cleared', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);
      builder.match({ status: 'PENDING' }).limit(5);
      expect(builder.getPipeline()).toHaveLength(2);

      builder.reset();

      expect(builder.getPipeline()).toEqual([]);
    });
  });

  // ==========================================
  // RULE 2: COMPLEX STAGE VARIATIONS & IMMUTABILITY (3 Tests)
  // ==========================================
  describe('Rule 2: Complex Stage Variations & Pipeline Immutability', () => {
    it('4. Scenario: Given lookup with sub-pipeline and let variables, When lookup is added, Then stage structure is preserved', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);

      const pipeline = builder
        .lookup({
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$customerId', '$$userId'] } } },
            { $limit: 5 },
          ],
          as: 'recentOrders',
        })
        .getPipeline();

      expect(pipeline[0]).toEqual({
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$customerId', '$$userId'] } } },
            { $limit: 5 },
          ],
          as: 'recentOrders',
        },
      });
    });

    it('5. Scenario: Given unwind with object options, When unwind is chained, Then options are preserved', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);

      const pipeline = builder
        .unwind({
          path: '$items',
          preserveNullAndEmptyArrays: true,
        })
        .getPipeline();

      expect(pipeline[0]).toEqual({
        $unwind: {
          path: '$items',
          preserveNullAndEmptyArrays: true,
        },
      });
    });

    it('6. Scenario: Given array returned by getPipeline(), When caller mutates returned array, Then internal builder pipeline remains isolated', () => {
      const { mockModel } = createMockModel();
      const builder = new AggregationBuilder(mockModel);
      builder.match({ active: true });

      const exportedPipeline = builder.getPipeline();
      exportedPipeline.push({ $limit: 99 } as any);

      expect(exportedPipeline).toHaveLength(2);
      expect(builder.getPipeline()).toHaveLength(1);
    });
  });

  // ==========================================
  // RULE 3: PIPELINE EXECUTION & RESILIENCE (3 Tests)
  // ==========================================
  describe('Rule 3: Pipeline Execution, Resilience & Error Propagation', () => {
    it('7. Scenario: Given configured aggregation pipeline, When execute is invoked, Then it should execute model.aggregate and return results', async () => {
      const { mockModel, mockAggregate } = createMockModel();
      const builder = new AggregationBuilder(mockModel);

      const results = await builder
        .match({ isDeleted: false })
        .group({ _id: '$role', count: { $sum: 1 } })
        .execute();

      expect(mockAggregate).toHaveBeenCalledTimes(1);
      expect(mockAggregate).toHaveBeenCalledWith([
        { $match: { isDeleted: false } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]);
      expect(results).toEqual([
        { _id: 'admin', count: 12 },
        { _id: 'user', count: 45 },
      ]);
    });

    it('8. Scenario: Given database aggregation failure (rejection), When execute is invoked, Then error is properly propagated', async () => {
      const { mockModel, mockAggregate } = createMockModel();
      mockAggregate.mockRejectedValue(new Error('Mongo aggregation memory limit exceeded'));

      const builder = new AggregationBuilder(mockModel);

      await expect(
        builder.match({ status: 'ACTIVE' }).execute(),
      ).rejects.toThrow('Mongo aggregation memory limit exceeded');
    });

    it('9. Scenario: Given model without modelName property, When execute is invoked, Then fallback model name is resolved gracefully', async () => {
      const mockAggregate = vi.fn(async () => [{ total: 100 }]);
      const modelWithoutName = {
        collection: { name: 'tasks' },
        aggregate: mockAggregate,
      } as any;

      const builder = new AggregationBuilder(modelWithoutName);
      const results = await builder.count('total').execute();

      expect(results).toEqual([{ total: 100 }]);
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // RULE 4: APM METRIC PIPELINE SUMMARIZATION (3 Tests)
  // ==========================================
  describe('Rule 4: APM Metric Pipeline Summarization Edge-Cases', () => {
    it('10. Scenario: Given complex multi-stage pipeline, When summarizePipeline is called, Then it should return clean arrow-separated summary', () => {
      const pipeline: any[] = [
        { $match: { status: 'ACTIVE', role: 'ADMIN' } },
        { $lookup: { from: 'profiles' } },
        { $group: { _id: 'role', total: { $sum: 1 } } },
        { $sort: { createdAt: -1, priority: 1 } },
        { $project: { name: 1, email: 1, _id: 0 } },
        { $facet: { meta: [], data: [] } },
      ];

      const summary = summarizePipeline(pipeline);

      expect(summary).toBe(
        "$match(status=ACTIVE) → $lookup(from='profiles') → $group(_id='role') → $sort(createdAt,priority) → $project(3 fields) → $facet(meta,data)",
      );
    });

    it('11. Scenario: Given empty aggregation pipeline, When summarizePipeline is called, Then it should return empty string', () => {
      const pipeline: any[] = [];
      const summary = summarizePipeline(pipeline);

      expect(summary).toBe('');
    });

    it('12. Scenario: Given custom and unrecognized MongoDB stages ($geoNear, $sample), When summarizePipeline is called, Then stage keys are preserved as fallbacks', () => {
      const pipeline: any[] = [
        { $geoNear: { near: { type: 'Point', coordinates: [0, 0] } } },
        { $sample: { size: 5 } },
        { $match: {} },
        { $group: {} },
      ];

      const summary = summarizePipeline(pipeline);

      expect(summary).toBe('$geoNear → $sample → $match → $group');
    });
  });
});
