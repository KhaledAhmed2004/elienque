import {
  GrowthType,
  IStatistic,
  ITrendPoint,
} from '../../../helpers/analytics/analytics.types';

export interface IAdminStatMetric {
  count: number;
  growth: number;
  growthType: GrowthType;
}

export type IAdminDashboardStats = {
  period: {
    type: string;
    comparison: string;
  };
  users: IAdminStatMetric;
  activeSubscriptions: IAdminStatMetric;
  pendingDrivers: IAdminStatMetric;
  activeJobs: IAdminStatMetric;
  totalItems: IAdminStatMetric;
};

export type IMonthlyTrends = {
  jobTrends: ITrendPoint[];
  itemTrends: ITrendPoint[];
};

export interface IMonthlyTrendsFilters {
  year?: number;
  range?: '3m' | '6m' | '12m' | 'this-year' | string;
  metric?: 'all' | 'jobs' | 'items' | string;
}

export type ActivityType =
  | 'USER_REGISTERED'
  | 'USER_PENDING'
  | 'JOB_POSTED'
  | 'ITEM_LISTED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'GENERAL';

export interface IRecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
