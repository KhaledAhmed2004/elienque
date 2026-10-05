import { Model, Types } from 'mongoose';
import {
  ACCOUNT_STATE,
  APP_STATE,
  CARD_PAYMENT_STATUS,
  COMPANY_ROLE,
  USER_ROLES,
} from '../../../enums/user';
import { GrowthType } from '../../../helpers/analytics/analytics.types';

export type IPaymentMethods = {
  zelle?: {
    email?: string;
  };
  venmo?: {
    username?: string;
  };
  cashApp?: {
    cashtag?: string;
  };
  cardPayment?: {
    status?: CARD_PAYMENT_STATUS;
  };
};

export type IUser = {
  name: string;
  nickname?: string;
  role: USER_ROLES;
  email: string;
  password?: string; // Optional because of select: false
  phone: string;
  serviceAreaId?: Types.ObjectId;
  serviceArea?: any; // Populated or legacy alias
  companyName?: string;
  company?: string; // Legacy alias
  companyRole?: COMPANY_ROLE;
  profilePicture?: string;
  drivingLicense?: {
    image?: string;
    expiryDate?: Date;
  };
  hackLicense?: {
    image?: string;
    expiryDate?: Date;
  };
  localPermit?: {
    image?: string;
    expiryDate?: Date;
  };
  accountState: ACCOUNT_STATE;
  appState?: APP_STATE;
  isOnboard?: boolean;
  mustChangePassword?: boolean;
  suspensionOrigin?: ACCOUNT_STATE;
  deviceTokens?: string[];
  selectedVehicle?: Types.ObjectId;
  favoriteChauffeurs?: Types.ObjectId[];
  averageRating: number;
  totalReviews: number;
  badges?: string[];
  paymentMethods?: IPaymentMethods;
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
  authentication?: {
    hashedOtp?: string;
    expireAt?: Date;
    attempts: number;
    resendTimestamps: Date[];
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