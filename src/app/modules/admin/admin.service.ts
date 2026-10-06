import { AnalyticsHelper } from '../../../helpers/analytics';
import { USER_ROLES, APP_STATE } from '../../../enums/user';
import { User } from '../user/user.model';
import { IUser } from '../user/user.interface';
import { Subscription } from '../subscription/subscription.model';
import { ISubscription, SUBSCRIPTION_STATUS } from '../subscription/subscription.interface';
import { Job } from '../job/job.model';
import { IJob, JOB_STATUS } from '../job/job.interface';
import { Item } from '../item/item.model';
import { IItem } from '../item/item.interface';
import {
  IAdminDashboardStats,
  IAdminStatMetric,
  IMonthlyTrends,
  IMonthlyTrendsFilters,
  IRecentActivity,
} from './admin.interface';
import { IStatistic, ITrendPoint } from '../../../helpers/analytics/analytics.types';

const getAdminDashboardStats = async (): Promise<IAdminDashboardStats> => {
  const [users, activeSubscriptions, pendingDrivers, activeJobs, totalItems] =
    await Promise.all([
      new AnalyticsHelper<IUser>(User).calculateGrowth({
        period: 'month',
      }),

      new AnalyticsHelper<ISubscription>(Subscription).calculateGrowth({
        filter: { status: SUBSCRIPTION_STATUS.ACTIVE },
        period: 'month',
      }),

      new AnalyticsHelper<IUser>(User).calculateGrowth({
        filter: { role: USER_ROLES.PROMOTER },
        period: 'month',
      }),
      new AnalyticsHelper<IJob>(Job).calculateGrowth({
        filter: {
          status: { $nin: [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED] },
        },
        period: 'month',
      }),

      new AnalyticsHelper<IItem>(Item).calculateGrowth({
        period: 'month',
      }),
    ]);

  const formatMetric = (stat: IStatistic): IAdminStatMetric => ({
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

const getMonthlyTrends = async (
  filters?: IMonthlyTrendsFilters | number,
): Promise<IMonthlyTrends> => {
  const options: IMonthlyTrendsFilters =
    typeof filters === 'number' ? { year: filters } : filters || {};

  const { year, range, metric = 'all' } = options;

  const fetchJobs = metric === 'all' || metric === 'jobs';
  const fetchItems = metric === 'all' || metric === 'items';

  const [rawJobTrends, rawItemTrends] = await Promise.all([
    fetchJobs
      ? new AnalyticsHelper<IJob>(Job).getTimeTrends({
          timeUnit: 'month',
          year,
        })
      : Promise.resolve([]),
    fetchItems
      ? new AnalyticsHelper<IItem>(Item).getTimeTrends({
          timeUnit: 'month',
          year,
        })
      : Promise.resolve([]),
  ]);

  const sliceByRange = (data: ITrendPoint[]) => {
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

interface IRawRecentUser {
  _id: { toString(): string } | string;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: Date | string;
}

interface IRawRecentJob {
  _id: { toString(): string } | string;
  pickup?: string;
  dropoff?: string;
  status?: string;
  paymentAmount?: number;
  createdAt?: Date | string;
}

interface IRawRecentItem {
  _id: { toString(): string } | string;
  title?: string;
  condition?: string;
  location?: string;
  price?: number;
  createdAt?: Date | string;
}

interface IRawRecentSubscription {
  _id: { toString(): string } | string;
  plan?: string;
  userId?: { toString(): string } | string;
  status?: string;
  createdAt?: Date | string;
}

const getRecentActivities = async (limit: number = 5): Promise<IRecentActivity[]> => {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const [recentUsers, recentJobs, recentItems, recentSubscriptions] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .select('_id name email role createdAt')
      .lean<IRawRecentUser[]>(),
    Job.find()
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .select('_id pickup dropoff jobType status paymentAmount createdAt createdBy')
      .lean<IRawRecentJob[]>(),
    Item.find()
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .select('_id title condition price status location createdAt createdBy')
      .lean<IRawRecentItem[]>(),
    Subscription.find()
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .select('_id plan userId status createdAt')
      .lean<IRawRecentSubscription[]>(),
  ]);

  const activities: IRecentActivity[] = [];

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

export const AdminService = {
  getAdminDashboardStats,
  getMonthlyTrends,
  getRecentActivities,
};
