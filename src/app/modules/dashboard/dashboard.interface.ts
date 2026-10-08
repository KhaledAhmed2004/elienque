import {
  GrowthType,
  IStatistic,
  ITrendPoint,
} from '../../../helpers/analytics/analytics.types';

export interface IDashboardStatMetric {
  count: number;
  growth: number;
  growthType: GrowthType;
}

export type IDashboardDashboardStats = {
  period: {
    type: string;
    comparison: string;
  };
  users: IDashboardStatMetric;
  activeSubscriptions: IDashboardStatMetric;
  activeCampaigns: IDashboardStatMetric;
  activePosts: IDashboardStatMetric;
  totalLeads: IDashboardStatMetric;
};

export type IMonthlyTrends = {
  campaignTrends: ITrendPoint[];
  postTrends: ITrendPoint[];
};

export interface IMonthlyTrendsFilters {
  year?: number;
  range?: '3m' | '6m' | '12m' | 'this-year' | string;
  metric?: 'all' | 'campaigns' | 'posts' | string;
}

export type ActivityType =
  | 'USER_REGISTERED'
  | 'USER_PENDING'
  | 'CAMPAIGN_POSTED'
  | 'POST_LISTED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'GENERAL';

export interface IRecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
  metadata?: Record<string, unknown>;
}
