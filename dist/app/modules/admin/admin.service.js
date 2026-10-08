"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const analytics_1 = require("../../../helpers/analytics");
const user_1 = require("../../../enums/user");
const user_model_1 = require("../user/user.model");
const subscription_model_1 = require("../subscription/subscription.model");
const subscription_interface_1 = require("../subscription/subscription.interface");
const job_model_1 = require("../job/job.model");
const job_interface_1 = require("../job/job.interface");
const item_model_1 = require("../item/item.model");
const getAdminDashboardStats = async () => {
    const [users, activeSubscriptions, pendingDrivers, activeJobs, totalItems] = await Promise.all([
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(subscription_model_1.Subscription).calculateGrowth({
            filter: { status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            filter: { role: user_1.USER_ROLES.PROMOTER },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(job_model_1.Job).calculateGrowth({
            filter: {
                status: { $nin: [job_interface_1.JOB_STATUS.COMPLETED, job_interface_1.JOB_STATUS.CANCELLED] },
            },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(item_model_1.Item).calculateGrowth({
            period: 'month',
        }),
    ]);
    const formatMetric = (stat) => ({
        count: stat.total,
        growth: stat.growth,
        growthType: stat.growthType,
    });
    return {
        period: {
            type: 'monthly',
            comparison: 'previous_period',
        },
        users: formatMetric(users),
        activeSubscriptions: formatMetric(activeSubscriptions),
        pendingDrivers: formatMetric(pendingDrivers),
        activeJobs: formatMetric(activeJobs),
        totalItems: formatMetric(totalItems),
    };
};
const getMonthlyTrends = async (filters) => {
    const options = typeof filters === 'number' ? { year: filters } : filters || {};
    const { year, range, metric = 'all' } = options;
    const fetchJobs = metric === 'all' || metric === 'jobs';
    const fetchItems = metric === 'all' || metric === 'items';
    const [rawJobTrends, rawItemTrends] = await Promise.all([
        fetchJobs
            ? new analytics_1.AnalyticsHelper(job_model_1.Job).getTimeTrends({
                timeUnit: 'month',
                year,
            })
            : Promise.resolve([]),
        fetchItems
            ? new analytics_1.AnalyticsHelper(item_model_1.Item).getTimeTrends({
                timeUnit: 'month',
                year,
            })
            : Promise.resolve([]),
    ]);
    const sliceByRange = (data) => {
        if (!range || range === '12m' || range === 'this-year' || data.length === 0) {
            return data;
        }
        const currentYear = new Date().getFullYear();
        const isCurrentYear = !year || year === currentYear;
        const currentMonthIdx = new Date().getMonth();
        const baseData = isCurrentYear
            ? data.slice(0, currentMonthIdx + 1)
            : data;
        if (range === '3m') {
            return baseData.slice(-3);
        }
        if (range === '6m') {
            return baseData.slice(-6);
        }
        return data;
    };
    return {
        jobTrends: sliceByRange(rawJobTrends),
        itemTrends: sliceByRange(rawItemTrends),
    };
};
const getRecentActivities = async (limit = 5) => {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const [recentUsers, recentJobs, recentItems, recentSubscriptions] = await Promise.all([
        user_model_1.User.find()
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .select('_id name email role createdAt')
            .lean(),
        job_model_1.Job.find()
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .select('_id pickup dropoff jobType status paymentAmount createdAt createdBy')
            .lean(),
        item_model_1.Item.find()
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .select('_id title condition price status location createdAt createdBy')
            .lean(),
        subscription_model_1.Subscription.find()
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .select('_id plan userId status createdAt')
            .lean(),
    ]);
    const activities = [];
    // 1. Process User events
    for (const u of recentUsers) {
        if (u.createdAt) {
            const userIdStr = u._id ? u._id.toString() : '';
            activities.push({
                id: userIdStr,
                type: 'USER_REGISTERED',
                title: 'New user registered',
                description: `${u.name || 'A new user'} joined the platform`,
                timestamp: new Date(u.createdAt),
                metadata: {
                    userId: userIdStr,
                    email: u.email,
                    role: u.role,
                },
            });
        }
    }
    // 2. Process Job events
    for (const j of recentJobs) {
        if (j.createdAt) {
            const jobIdStr = j._id ? j._id.toString() : '';
            activities.push({
                id: jobIdStr,
                type: 'JOB_POSTED',
                title: 'New job offer posted',
                description: `Ride requested: ${j.pickup || 'Location'} → ${j.dropoff || 'Destination'}`,
                timestamp: new Date(j.createdAt),
                metadata: {
                    jobId: jobIdStr,
                    pickup: j.pickup,
                    dropoff: j.dropoff,
                    status: j.status,
                    price: j.paymentAmount,
                    paymentAmount: j.paymentAmount,
                },
            });
        }
    }
    // 3. Process Item events
    for (const item of recentItems) {
        if (item.createdAt) {
            const itemIdStr = item._id ? item._id.toString() : '';
            activities.push({
                id: itemIdStr,
                type: 'ITEM_LISTED',
                title: 'New listing added',
                description: `Marketplace listing: ${item.title || 'Untitled item'}`,
                timestamp: new Date(item.createdAt),
                metadata: {
                    itemId: itemIdStr,
                    title: item.title,
                    condition: item.condition,
                    location: item.location,
                    price: item.price,
                },
            });
        }
    }
    // 4. Process Subscription events
    for (const sub of recentSubscriptions) {
        if (sub.createdAt) {
            const subIdStr = sub._id ? sub._id.toString() : '';
            activities.push({
                id: subIdStr,
                type: 'SUBSCRIPTION_ACTIVATED',
                title: 'New subscription activated',
                description: 'Subscription package activated',
                timestamp: new Date(sub.createdAt),
                metadata: {
                    subscriptionId: subIdStr,
                    plan: sub.plan,
                    status: sub.status,
                },
            });
        }
    }
    // Sort unified activities chronologically descending (newest first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    // Return top items up to safeLimit
    return activities.slice(0, safeLimit);
};
exports.AdminService = {
    getAdminDashboardStats,
    getMonthlyTrends,
    getRecentActivities,
};
//# sourceMappingURL=admin.service.js.map