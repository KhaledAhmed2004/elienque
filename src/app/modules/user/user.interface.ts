import { Model, Types } from 'mongoose';
import {
  ACCOUNT_STATE,
  APP_STATE,
  CARD_PAYMENT_STATUS,
  USER_ROLES,
} from '../../../enums/user';
import { GrowthType } from '../../../helpers/analytics/analytics.types';

export type IUser = {
  name: string;
  nickname?: string;
  role: USER_ROLES;
  businessName?: string;
  email: string;
  password?: string; // Optional because of select: false
  needsPasswordChange?: boolean;
  phone: string;
  profilePicture?: string;
  accountState: ACCOUNT_STATE;
  deviceTokens?: string[];
  averageRating: number;
  totalReviews: number;
  loginAttempts: number;
  lockUntil?: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  blockReason?: string;
  suspendedAt?: Date;
  suspendedBy?: Types.ObjectId;
  rejectionReason?: string;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  reactivatedAt?: Date;
  reactivatedBy?: Types.ObjectId;
  rewardBalance: number;
  paymentMethods?: any;
  authentication?: {
    hashedOtp?: string;
    expireAt?: Date;
    attempts: number;
    resendTimestamps: Date[];
    purpose?: string;
  };
};

export type UserModel = {
  isExistUserById(id: string): Promise<IUser | null>;
  isExistUserByEmail(email: string): Promise<IUser | null>;
  isMatchPassword(password: string, hashPassword: string): Promise<boolean>;
  addDeviceToken(userId: string, token: string): Promise<IUser | null>;
  removeDeviceToken(userId: string, token: string): Promise<IUser | null>;
} & Model<IUser>;

export type UserModal = UserModel;

export type IUserStatMetric = {
  count: number;
  growth: number;
  growthType: GrowthType;
};

export type IUserStats = {
  period: {
    type: 'monthly';
    comparison: 'previous_period';
  };
  totalUsers: IUserStatMetric;
  activeUsers: IUserStatMetric;
  pendingUsers: IUserStatMetric;
  suspendedUsers: IUserStatMetric;
  totalDrivers?: IUserStatMetric;
  approvedDrivers?: IUserStatMetric;
  pendingDrivers?: IUserStatMetric;
  suspendedDrivers?: IUserStatMetric;
};
