"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGrowthDynamic = exports.AnalyticsHelper = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const requestContext_1 = require("../../app/logging/requestContext");
const datePeriod_helper_1 = require("./datePeriod.helper");
class AnalyticsHelper {
    model;
    constructor(model) {
        this.model = model;
    }
    async executePipeline(pipeline) {
        const _start = Date.now();
        const res = await this.model.aggregate(pipeline);
        const dur = Date.now() - _start;
        const modelName = this.model?.modelName ||
            this.model?.collection?.name ||
            'UnknownModel';
        (0, requestContext_1.recordDbQuery)(dur, {
            model: modelName,
            operation: 'analytics_aggregate',
            cacheHit: false,
        });
        return res;
    }
    // ====== 1. OPTIMIZED GROWTH CALCULATION (SINGLE $facet QUERY) ======
    async calculateGrowth(options = {}) {
        try {
            const { sumField, filter = {}, groupBy, period = 'month' } = options;
            const { startThis, startLast, endLast } = (0, datePeriod_helper_1.getPeriodDates)(period);
            const makeGroupStages = () => {
                const groupSpec = {
                    _id: groupBy ? `$${groupBy}` : null,
                    total: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
                };
                const stages = [
                    { $group: groupSpec },
                ];
                if (groupBy) {
                    stages.push({ $group: { _id: null, total: { $sum: '$total' } } });
                }
                return stages;
            };
            const facetPipeline = [
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
            const thisPeriodCount = facetResult?.thisPeriod?.[0]?.total || 0;
            const lastPeriodCount = facetResult?.lastPeriod?.[0]?.total || 0;
            const total = facetResult?.total?.[0]?.total || 0;
            // Calculate percentage growth
            let growth = 0;
            let growthType = 'no_change';
            if (lastPeriodCount > 0) {
                const rawGrowth = ((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100;
                growth = Math.round(Math.abs(rawGrowth) * 100) / 100;
                growthType =
                    rawGrowth > 0 ? 'increase' : rawGrowth < 0 ? 'decrease' : 'no_change';
            }
            else if (thisPeriodCount > 0 && lastPeriodCount === 0) {
                growth = 100;
                growthType = 'increase';
            }
            else {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to calculate growth: ${errorMessage}`);
        }
    }
    // ====== 2. REVENUE BREAKDOWN ======
    async getRevenueBreakdown(options) {
        try {
            const { sumField, groupByField, filter = {}, limit = 10 } = options;
            const pipeline = [
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get revenue breakdown: ${errorMessage}`);
        }
    }
    // ====== 3. TIME TRENDS (FIXED YEAR FILTER & O(1) ZERO-FILLING) ======
    async getTimeTrends(options) {
        try {
            const { sumField, timeUnit, filter = {}, year } = options;
            const now = new Date();
            const currentYear = year && !isNaN(year) ? year : now.getFullYear();
            const currentMonth = now.getMonth(); // 0-indexed
            // Date range filter tailored per timeUnit
            let dateFilter = {};
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
                            $lte: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
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
            const dateGrouping = {
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
            const pipeline = [
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
                        if (typeof item._id?.month === 'number' &&
                            item._id.month >= 1 &&
                            item._id.month <= 12) {
                            const index = item._id.month - 1;
                            months[index].total = item.total;
                            months[index].count = item.count;
                        }
                    }
                    return months.map(m => ({
                        label: new Date(currentYear, m.month - 1).toLocaleString('default', {
                            month: 'short',
                        }),
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
                        if (item._id?.year === currentYear &&
                            typeof item._id.week === 'number') {
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
                    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                    const days = Array.from({ length: daysInMonth }, (_, i) => ({
                        day: i + 1,
                        total: 0,
                        count: 0,
                    }));
                    for (const item of results) {
                        if (item._id?.year === currentYear &&
                            item._id?.month === currentMonth + 1 &&
                            typeof item._id?.day === 'number') {
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
                    const yearMap = new Map();
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get time trends: ${errorMessage}`);
        }
    }
    // ====== 4. TOP PERFORMERS ======
    async getTopPerformers(options) {
        try {
            const { sumField, groupByField, filter = {}, limit = 10, period, } = options;
            let dateFilter = {};
            if (period) {
                const { startThis } = (0, datePeriod_helper_1.getPeriodDates)(period);
                dateFilter = { createdAt: { $gte: startThis } };
            }
            const pipeline = [
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get top performers: ${errorMessage}`);
        }
    }
}
exports.AnalyticsHelper = AnalyticsHelper;
// ====== DYNAMIC HELPER WRAPPER (PRESERVED FOR FUTURE USE) ======
const calculateGrowthDynamic = async (Model, options = {}) => {
    const analyticsHelper = new AnalyticsHelper(Model);
    return await analyticsHelper.calculateGrowth(options);
};
exports.calculateGrowthDynamic = calculateGrowthDynamic;
exports.default = AnalyticsHelper;
//# sourceMappingURL=analytics.helper.js.map