export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GrowthType = 'increase' | 'decrease' | 'no_change';

export type IGrowthOptions = {
  sumField?: string; // Field to sum for revenue/value calculations
  filter?: Record<string, any>; // Additional match filters
  groupBy?: string; // Field to group by (optional)
  period?: PeriodType; // Growth period
}

export type IStatistic = {
  total: number;
  thisPeriodCount: number;
  lastPeriodCount: number;
  growth: number;
  formattedGrowth?: string;
  growthType: GrowthType;
}

export type IRevenueBreakdownOptions = {
  sumField: string;
  groupByField: string;
  filter?: Record<string, any>;
  limit?: number;
}

export type IRevenueBreakdownResult = {
  [key: string]: any;
  totalRevenue: number;
  count: number;
  averageRevenue: number;
}

export type ITimeTrendsOptions = {
  sumField?: string;
  timeUnit: 'day' | 'week' | 'month' | 'year';
  filter?: Record<string, any>;
  limit?: number;
  year?: number;
};

export type ITrendPoint = {
  label: string;
  totalRevenue: number;
  transactionCount: number;
}

export type ITopPerformersOptions = {
  sumField: string;
  groupByField: string;
  filter?: Record<string, any>;
  limit?: number;
  period?: PeriodType;
}

export type ITopPerformerResult = {
  [key: string]: any;
  totalValue: number;
  count: number;
  averageValue: number;
  firstSeen: Date;
  lastSeen: Date;
  rank: number;
}
