import { AnalyticsHelper } from '../../../helpers/analytics';
import { USER_ROLES } from '../../../enums/user';
import { User } from '../user/user.model';
import { IUser } from '../user/user.interface';
import { Subscription } from '../subscription/subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_STATUS,
} from '../subscription/subscription.interface';
import { Campaign } from '../campaign/campaign.model';
import { ICampaign } from '../campaign/campaign.interface';
import { Post } from '../post/post.model';
import { IPost } from '../post/post.interface';
import { BusinessLead } from '../lead/lead.model';
import { IBusinessLead } from '../lead/lead.interface';

import {
  IDashboardDashboardStats,
  IDashboardStatMetric,
  IMonthlyTrends,
  IMonthlyTrendsFilters,
  IRecentActivity,
} from './dashboard.interface';
import {
  IStatistic,
  ITrendPoint,
} from '../../../helpers/analytics/analytics.types';

const getDashboardDashboardStats = async (): Promise<IDashboardDashboardStats> => {
  const [users, activeSubscriptions, activeCampaigns, activePosts, totalLeads] =
    await Promise.all([
      new AnalyticsHelper<IUser>(User).calculateGrowth({ period: 'month' }),
      new AnalyticsHelper<ISubscription>(Subscription).calculateGrowth({
        filter: { status: SUBSCRIPTION_STATUS.ACTIVE },
        period: 'month',
      }),
      new AnalyticsHelper<ICampaign>(Campaign as any).calculateGrowth({
        period: 'month',
      }),
      new AnalyticsHelper<IPost>(Post as any).calculateGrowth({
        period: 'month',
      }),
      new AnalyticsHelper<IBusinessLead>(BusinessLead as any).calculateGrowth({
        period: 'month',
      }),
    ]);

  const formatMetric = (stat: IStatistic): IDashboardStatMetric => ({
    count: stat.total,
    growth: stat.growth,
    growthType: stat.growthType,
  });

  return {
    period: { type: 'monthly', comparison: 'previous_period' },
    users: formatMetric(users),
    activeSubscriptions: formatMetric(activeSubscriptions),
    activeCampaigns: formatMetric(activeCampaigns),
    activePosts: formatMetric(activePosts),
    totalLeads: formatMetric(totalLeads),
  };
};

const getMonthlyTrends = async (
  filters?: IMonthlyTrendsFilters | number,
): Promise<IMonthlyTrends> => {
  const options: IMonthlyTrendsFilters =
    typeof filters === 'number' ? { year: filters } : filters || {};
  const { year, range, metric = 'all' } = options;

  const fetchCampaigns = metric === 'all' || metric === 'campaigns';
  const fetchPosts = metric === 'all' || metric === 'posts';

  const [rawCampaignTrends, rawPostTrends] = await Promise.all([
    fetchCampaigns
      ? new AnalyticsHelper<ICampaign>(Campaign as any).getTimeTrends({
          timeUnit: 'month',
          year,
        })
      : Promise.resolve([]),
    fetchPosts
      ? new AnalyticsHelper<IPost>(Post as any).getTimeTrends({
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
    const baseData = isCurrentYear ? data.slice(0, currentMonthIdx + 1) : data;
    if (range === '3m') return baseData.slice(-3);
    if (range === '6m') return baseData.slice(-6);
    return data;
  };

  return {
    campaignTrends: sliceByRange(rawCampaignTrends),
    postTrends: sliceByRange(rawPostTrends),
  };
};

interface IRawRecentUser {
  _id: { toString(): string } | string;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: Date | string;
}

interface IRawRecentCampaign {
  _id: { toString(): string } | string;
  title?: string;
  status?: string;
  createdAt?: Date | string;
}

interface IRawRecentPost {
  _id: { toString(): string } | string;
  content?: string;
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
  const [recentUsers, recentCampaigns, recentPosts, recentSubscriptions] =
    await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(safeLimit).select('_id name email role createdAt').lean<IRawRecentUser[]>(),
      Campaign.find().sort({ createdAt: -1 }).limit(safeLimit).select('_id title status createdAt').lean<IRawRecentCampaign[]>(),
      Post.find().sort({ createdAt: -1 }).limit(safeLimit).select('_id content createdAt').lean<IRawRecentPost[]>(),
      Subscription.find().sort({ createdAt: -1 }).limit(safeLimit).select('_id plan userId status createdAt').lean<IRawRecentSubscription[]>(),
    ]);

  const activities: IRecentActivity[] = [];

  for (const u of recentUsers) {
    if (u.createdAt) {
      activities.push({
        id: u._id?.toString() || '',
        type: 'USER_REGISTERED',
        title: 'New user registered',
        description: `${u.name || 'A new user'} joined`,
        timestamp: new Date(u.createdAt),
        link: `/admin/users/${u._id}`,
      });
    }
  }

  for (const c of recentCampaigns) {
    if (c.createdAt) {
      activities.push({
        id: c._id?.toString() || '',
        type: 'CAMPAIGN_POSTED',
        title: 'New campaign created',
        description: `Campaign: ${c.title || 'Untitled'}`,
        timestamp: new Date(c.createdAt),
        link: `/admin/campaigns/${c._id}`,
      });
    }
  }

  for (const p of recentPosts) {
    if (p.createdAt) {
      activities.push({
        id: p._id?.toString() || '',
        type: 'POST_LISTED',
        title: 'New post',
        description: `Post content: ${p.content?.substring(0, 20)}...`,
        timestamp: new Date(p.createdAt),
        link: `/admin/posts/${p._id}`,
      });
    }
  }

  for (const sub of recentSubscriptions) {
    if (sub.createdAt) {
      activities.push({
        id: sub._id?.toString() || '',
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'New subscription',
        description: `Plan: ${sub.plan || 'Unknown'}`,
        timestamp: new Date(sub.createdAt),
        link: `/admin/subscriptions/${sub._id}`,
      });
    }
  }

  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return activities.slice(0, safeLimit);
};

const getTopPerformers = async (limit: number = 5, role?: string) => {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  
  const result: any = {};
  
  const fetchBusinesses = !role || role === USER_ROLES.BUSINESS_OWNER || role === 'ALL';
  const fetchPromoters = !role || role === USER_ROLES.PROMOTER || role === 'ALL';

  const [topBusinesses, topPromoters] = await Promise.all([
    fetchBusinesses ? User.find({ role: USER_ROLES.BUSINESS_OWNER })
      .limit(safeLimit).select('name businessName email profilePicture').lean() : Promise.resolve(null),
    fetchPromoters ? User.find({ role: USER_ROLES.PROMOTER })
      .limit(safeLimit).select('name nickname email profilePicture').lean() : Promise.resolve(null),
  ]);

  if (fetchBusinesses) result.topBusinesses = topBusinesses || [];
  if (fetchPromoters) result.topPromoters = topPromoters || [];

  return result;
};

export const DashboardService = {
  getDashboardDashboardStats,
  getMonthlyTrends,
  getRecentActivities,
  getTopPerformers,
};
