import { Model, PipelineStage } from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../../errors/ApiError';
import { recordDbQuery } from '../../app/logging/requestContext';
import {
  GrowthType,
  IGrowthOptions,
  IStatistic,
  IRevenueBreakdownOptions,
  IRevenueBreakdownResult,
  ITimeTrendsOptions,
  ITrendPoint,
  ITopPerformersOptions,
  ITopPerformerResult,
} from './analytics.types';
import { getPeriodDates } from './datePeriod.helper';

export class AnalyticsHelper<T> {
  private model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  private async executePipeline(pipeline: PipelineStage[]): Promise<any[]> {
    const _start = Date.now();
    const res = await this.model.aggregate(pipeline);
    const dur = Date.now() - _start;
    const modelName =
      (this.model as any)?.modelName ||
      (this.model as any)?.collection?.name ||
      'UnknownModel';
    recordDbQuery(dur, {
      model: modelName,
      operation: 'analytics_aggregate',
      cacheHit: false,
    });
    return res;
  }

  // ====== 1. OPTIMIZED GROWTH CALCULATION (SINGLE $facet QUERY) ======
  async calculateGrowth(options: IGrowthOptions = {}): Promise<IStatistic> {
    try {
      const { sumField, filter = {}, groupBy, period = 'month' } = options;
      const { startThis, startLast, endLast } = getPeriodDates(period);

      const makeGroupStages = (): PipelineStage.FacetPipelineStage[] => {
        const groupSpec: Record<string, any> = {
          _id: groupBy ? `$${groupBy}` : null,
          total: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
        };

        const stages: PipelineStage.FacetPipelineStage[] = [
          { $group: groupSpec },
        ];
        if (groupBy) {
          stages.push({ $group: { _id: null, total: { $sum: '$total' } } });
        }
        return stages;
      };

      const facetPipeline: PipelineStage[] = [
        { $match: filter },
        {
          $facet: {
            thisPeriod: [
              { $match: { createdAt: { $gte: startThis } } },
              ...makeGroupStages(),
            ],
            lastPeriod: [
              { $match: { createdAt: { $gte: startLast, $lte: endLast } } },
              ...makeGroupStages(),
            ],
            total: [...makeGroupStages()],
          },
        },
      ];

      const [facetResult] = await this.executePipeline(facetPipeline);

      const thisPeriodCount: number = facetResult?.thisPeriod?.[0]?.total || 0;
      const lastPeriodCount: number = facetResult?.lastPeriod?.[0]?.total || 0;
      const total: number = facetResult?.total?.[0]?.total || 0;

      // Calculate percentage growth
      let growth = 0;
      let growthType: GrowthType = 'no_change';

      if (lastPeriodCount > 0) {
        const rawGrowth =
          ((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100;
        growth = Math.round(Math.abs(rawGrowth) * 100) / 100;
        growthType =
          rawGrowth > 0 ? 'increase' : rawGrowth < 0 ? 'decrease' : 'no_change';
      } else if (thisPeriodCount > 0 && lastPeriodCount === 0) {
        growth = 100;
        growthType = 'increase';
      } else {
        growth = 0;
        growthType = 'no_change';
      }

      return {
        total,
        thisPeriodCount,
        lastPeriodCount,
        growth,
        growthType,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to calculate growth: ${errorMessage}`,
      );
    }
  }

  // ====== 2. REVENUE BREAKDOWN ======
  async getRevenueBreakdown(
    options: IRevenueBreakdownOptions,
  ): Promise<IRevenueBreakdownResult[]> {
    try {
      const { sumField, groupByField, filter = {}, limit = 10 } = options;

      const pipeline: PipelineStage[] = [
        { $match: filter },
        {
          $group: {
            _id: `$${groupByField}`,
            totalRevenue: { $sum: `$${sumField}` },
            count: { $sum: 1 },
            averageRevenue: { $avg: `$${sumField}` },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            [groupByField]: '$_id',
            totalRevenue: { $round: ['$totalRevenue', 2] },
            count: 1,
            averageRevenue: { $round: ['$averageRevenue', 2] },
          },
        },
      ];

      return await this.executePipeline(pipeline);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get revenue breakdown: ${errorMessage}`,
      );
    }
  }

  // ====== 3. TIME TRENDS (FIXED YEAR FILTER & O(1) ZERO-FILLING) ======
  async getTimeTrends(options: ITimeTrendsOptions): Promise<ITrendPoint[]> {
    try {
      const { sumField, timeUnit, filter = {}, year } = options;

      const now = new Date();
      const currentYear = year && !isNaN(year) ? year : now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Date range filter tailored per timeUnit
      let dateFilter: Record<string, any> = {};

      switch (timeUnit) {
        case 'month':
        case 'week':
          dateFilter = {
            createdAt: {
              $gte: new Date(currentYear, 0, 1),
              $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
            },
          };
          break;
        case 'day':
          dateFilter = {
            createdAt: {
              $gte: new Date(currentYear, currentMonth, 1),
              $lte: new Date(
                currentYear,
                currentMonth + 1,
                0,
                23,
                59,
                59,
                999,
              ),
            },
          };
          break;
        case 'year':
          // 5-year window: currentYear - 4 to currentYear
          dateFilter = {
            createdAt: {
              $gte: new Date(currentYear - 4, 0, 1),
              $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
            },
          };
          break;
      }

      const matchFilter = {
        ...filter,
        ...dateFilter,
      };

      const dateGrouping: Record<string, any> = {
        day: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        week: { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } },
        month: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        year: { year: { $year: '$createdAt' } },
      };

      const pipeline: PipelineStage[] = [
        { $match: matchFilter },
        {
          $group: {
            _id: dateGrouping[timeUnit],
            total: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            '_id.year': -1,
            '_id.month': -1,
            '_id.week': -1,
            '_id.day': -1,
          },
        },
      ];

      const results = await this.executePipeline(pipeline);

      // O(1) Index-based zero-filling
      switch (timeUnit) {
        case 'month': {
          const months = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            total: 0,
            count: 0,
          }));

          for (const item of results) {
            if (
              typeof item._id?.month === 'number' &&
              item._id.month >= 1 &&
              item._id.month <= 12
            ) {
              const index = item._id.month - 1;
              months[index].total = item.total;
              months[index].count = item.count;
            }
          }

          return months.map(m => ({
            label: new Date(currentYear, m.month - 1).toLocaleString(
              'default',
              {
                month: 'short',
              },
            ),
            totalRevenue: m.total,
            transactionCount: m.count,
          }));
        }

        case 'week': {
          const weeks = Array.from({ length: 52 }, (_, i) => ({
            week: i + 1,
            total: 0,
            count: 0,
          }));

          for (const item of results) {
            if (
              item._id?.year === currentYear &&
              typeof item._id.week === 'number'
            ) {
              const index = item._id.week - 1;
              if (index >= 0 && index < 52) {
                weeks[index].total = item.total;
                weeks[index].count = item.count;
              }
            }
          }

          return weeks.map(w => ({
            label: `Week ${w.week}`,
            totalRevenue: w.total,
            transactionCount: w.count,
          }));
        }

        case 'day': {
          const daysInMonth = new Date(
            currentYear,
            currentMonth + 1,
            0,
          ).getDate();

          const days = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            total: 0,
            count: 0,
          }));

          for (const item of results) {
            if (
              item._id?.year === currentYear &&
              item._id?.month === currentMonth + 1 &&
              typeof item._id?.day === 'number'
            ) {
              const index = item._id.day - 1;
              if (index >= 0 && index < daysInMonth) {
                days[index].total = item.total;
                days[index].count = item.count;
              }
            }
          }

          const monthName = now.toLocaleString('default', { month: 'short' });
          return days.map(d => ({
            label: `${monthName} ${d.day}`,
            totalRevenue: d.total,
            transactionCount: d.count,
          }));
        }

        case 'year': {
          const yearMap = new Map<number, { total: number; count: number }>();
          for (let i = 0; i < 5; i++) {
            yearMap.set(currentYear - (4 - i), { total: 0, count: 0 });
          }

          for (const item of results) {
            const yr = item._id?.year;
            if (typeof yr === 'number' && yearMap.has(yr)) {
              yearMap.set(yr, { total: item.total, count: item.count });
            }
          }

          return Array.from(yearMap.entries()).map(([year, data]) => ({
            label: `${year}`,
            totalRevenue: data.total,
            transactionCount: data.count,
          }));
        }

        default:
          return results;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get time trends: ${errorMessage}`,
      );
    }
  }

  // ====== 4. TOP PERFORMERS ======
  async getTopPerformers(
    options: ITopPerformersOptions,
  ): Promise<ITopPerformerResult[]> {
    try {
      const {
        sumField,
        groupByField,
        filter = {},
        limit = 10,
        period,
      } = options;

      let dateFilter = {};
      if (period) {
        const { startThis } = getPeriodDates(period);
        dateFilter = { createdAt: { $gte: startThis } };
      }

      const pipeline: PipelineStage[] = [
        { $match: { ...filter, ...dateFilter } },
        {
          $group: {
            _id: `$${groupByField}`,
            totalValue: { $sum: `$${sumField}` },
            count: { $sum: 1 },
            averageValue: { $avg: `$${sumField}` },
            firstSeen: { $min: '$createdAt' },
            lastSeen: { $max: '$createdAt' },
          },
        },
        { $sort: { totalValue: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            [groupByField]: '$_id',
            totalValue: { $round: ['$totalValue', 2] },
            count: 1,
            averageValue: { $round: ['$averageValue', 2] },
            firstSeen: 1,
            lastSeen: 1,
          },
        },
      ];

      const rawResults = await this.executePipeline(pipeline);

      // Clean 1-based ranking
      return rawResults.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to get top performers: ${errorMessage}`,
      );
    }
  }
}

// ====== DYNAMIC HELPER WRAPPER (PRESERVED FOR FUTURE USE) ======
export const calculateGrowthDynamic = async (
  Model: any,
  options: IGrowthOptions = {},
): Promise<IStatistic> => {
  const analyticsHelper = new AnalyticsHelper(Model);
  return await analyticsHelper.calculateGrowth(options);
};

export default AnalyticsHelper;
