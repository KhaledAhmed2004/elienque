import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import {
  ACCOUNT_STATE,
  USER_ROLES,
} from '../../../enums/user';
import { Types } from 'mongoose';
import { Subscription as SubscriptionModel } from '../subscription/subscription.model';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import unlinkFile from '../../../shared/unlinkFile';
import { User } from './user.model';
import QueryBuilder from '../../builder/QueryBuilder';
import CursorQueryBuilder from '../../builder/CursorQueryBuilder';
import { IUser, IUserStats, IUserStatMetric } from './user.interface';
import { AnalyticsHelper } from '../../../helpers/analytics';
import { IStatistic } from '../../../helpers/analytics/analytics.types';
import bcrypt from 'bcrypt';
import { logger } from '../../../shared/logger';

import config from '../../../config';

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id, role } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const userObj = (isExistUser as any).toJSON
    ? (isExistUser as any).toJSON()
    : { ...isExistUser };

  // Normal users do not see internal role, license document objects, ratings, or favorite arrays in their self-profile
  // Admin has full visibility
  if (role !== USER_ROLES.ADMIN) {
    delete (userObj as any).role;
    delete (userObj as any).averageRating;
    delete (userObj as any).totalReviews;
    delete (userObj as any).uploadedHeadshot;
  }

  return userObj;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Record<string, any>,
): Promise<Partial<IUser | null>> => {
    const { id, role } = user;
    const isExistUser = await User.isExistUserById(id);
    if (!isExistUser) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }

    if (payload.profilePicture && isExistUser.profilePicture) {
      unlinkFile(isExistUser.profilePicture);
    }

    const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
      new: true,
    });

    if (!updateDoc) return null;

    const userObj = updateDoc.toJSON ? updateDoc.toJSON() : { ...updateDoc };
    if (role !== USER_ROLES.ADMIN) {
      delete (userObj as any).role;
      delete (userObj as any).averageRating;
      delete (userObj as any).totalReviews;
      delete (userObj as any).uploadedHeadshot;
    }

    return userObj;
};

const getAllUserRoles = async (query: Record<string, unknown>) => {
  const queryCopy = { ...query };
  const filterQuery: Record<string, any> = queryCopy.role
    ? { role: queryCopy.role }
    : { role: { $ne: USER_ROLES.ADMIN } };
  delete queryCopy.role;

  if (queryCopy.status) {
    const st = String(queryCopy.status).toUpperCase();
    delete queryCopy.status;
    if (st === 'SUSPENDED') {
      filterQuery.accountState = ACCOUNT_STATE.SUSPENDED;
    } else if (st === 'APPROVED' || st === 'ACTIVE') {
      filterQuery.accountState = { $ne: ACCOUNT_STATE.SUSPENDED };
    } else if (st === 'PENDING') {
      filterQuery.accountState = ACCOUNT_STATE.UNVERIFIED;
    } else if (st === 'REJECTED') {
      // No appState anymore
    }
  }

  const qb = new QueryBuilder(User.find(filterQuery), queryCopy)
    .filter()
    .sort()
    .paginate();

  // Select core fields needed for listing
  const docs = (await qb.modelQuery
    .select(
      '_id name email profilePicture status accountState company  role phone createdAt',
    )
    .lean()) as Array<any>;

  const paginationInfo = await qb.getPaginationInfo();

  // Build id arrays for lookups
  const idStrings = docs
    .map(d => (d._id ? d._id.toString() : null))
    .filter(Boolean) as string[];

  // Subscription per user
  const objectIds = idStrings.map(id => new Types.ObjectId(id));
  const subs = await SubscriptionModel.find({ userId: { $in: objectIds } })
    .select('userId plan status currentPeriodEnd')
    .lean();
  const subsMap = new Map<string, any>();
  for (const s of subs) {
    subsMap.set((s.userId as Types.ObjectId).toString(), {
      plan: s.plan,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd ?? null,
    });
  }

  // Compose final response objects
  const data = docs.map(d => {
    const id = d._id?.toString() as string | undefined;
    const sub = id ? subsMap.get(id) : null;

    let computedStatus = 'PENDING';
    if (
      d.accountState === ACCOUNT_STATE.SUSPENDED ||
      d.accountState === 'SUSPENDED'
    ) {
      computedStatus = 'SUSPENDED';
    } else if (d.accountState === ACCOUNT_STATE.VERIFIED || d.accountState === 'VERIFIED') {
      computedStatus = 'APPROVED';
    } else if (d.status) {
      computedStatus = d.status;
    }

    return {
      _id: d._id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      profile: d.profilePicture ?? null,
      profilePicture: d.profilePicture ?? null,
      
      status: computedStatus,
      subscription: sub ? { status: sub.status } : null,
      stats: {
        totalJobsCreated: 0,
        totalJobsCompleted: 0,
        payout: 0,
        earnings: 0,
      },
      createdAt: d.createdAt,
    };
  });

  return {
    pagination: paginationInfo,
    data,
  };
};

const approveChauffeur = async (id: string, adminId?: string) => {
  const user = await User.isExistUserById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }


  const now = new Date();
  const updatePayload: any = {
    accountState: ACCOUNT_STATE.VERIFIED,
    approvedAt: now,
  };

  if (adminId && Types.ObjectId.isValid(adminId)) {
    updatePayload.approvedBy = new Types.ObjectId(adminId);
  }

  const updatedUser = await User.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });

  if (updatedUser) {
    const loginUrl = `${config.frontend_url || 'http://localhost:3000'}/login`;
    const approvalTemplate = emailTemplate.accountApproved({
      name: updatedUser.name,
      email: updatedUser.email,
      loginUrl,
    });
    emailHelper.sendEmail(approvalTemplate);
  }

  return {
    id: updatedUser!._id.toString(),
    name: updatedUser!.name,
    email: updatedUser!.email,
    phone: updatedUser!.phone,
    role: updatedUser!.role,
    
    accountState: updatedUser!.accountState,
    approvedAt: updatedUser!.approvedAt,
    approvedBy: updatedUser!.approvedBy
      ? updatedUser!.approvedBy.toString()
      : adminId || null,
  };
};

const rejectChauffeur = async (id: string, reason?: string, adminId?: string) => {
  const user = await User.isExistUserById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const now = new Date();
  const rejectionReasonText =
    reason || 'Application rejected by platform administration';
  const updatePayload: any = {
    rejectionReason: rejectionReasonText,
    rejectedAt: now,
  };

  if (adminId && Types.ObjectId.isValid(adminId)) {
    updatePayload.rejectedBy = new Types.ObjectId(adminId);
  }

  const updatedUser = await User.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });

  return {
    id: updatedUser!._id.toString(),
    name: updatedUser!.name,
    email: updatedUser!.email,
    phone: updatedUser!.phone,
    role: updatedUser!.role,
    
    accountState: updatedUser!.accountState,
    reason: updatedUser!.rejectionReason,
    rejectedAt: updatedUser!.rejectedAt,
    rejectedBy: updatedUser!.rejectedBy
      ? updatedUser!.rejectedBy.toString()
      : adminId || null,
  };
};

const suspendChauffeur = async (id: string, reason?: string, adminId?: string) => {
  const user = await User.isExistUserById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const now = new Date();
  const updatePayload: any = {
    accountState: ACCOUNT_STATE.SUSPENDED,
    blockReason: reason ?? null,
    suspendedAt: now,
  };

  if (adminId && Types.ObjectId.isValid(adminId)) {
    updatePayload.suspendedBy = new Types.ObjectId(adminId);
  }

  const updatedUser = await User.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });

  return {
    id: updatedUser!._id.toString(),
    name: updatedUser!.name,
    email: updatedUser!.email,
    reason: updatedUser!.blockReason || reason || null,
    suspendedBy: updatedUser!.suspendedBy
      ? updatedUser!.suspendedBy.toString()
      : adminId || null,
    suspendedAt: updatedUser!.suspendedAt,
  };
};

const blockUser = async (id: string, reason?: string, adminId?: string) => {
  return suspendChauffeur(id, reason, adminId);
};

const reactivateChauffeur = async (id: string, adminId?: string) => {
  const user = await User.isExistUserById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const now = new Date();
  const updatePayload: any = {
    accountState: ACCOUNT_STATE.VERIFIED,
    blockReason: null,
    reactivatedAt: now,
  };

  if (adminId && Types.ObjectId.isValid(adminId)) {
    updatePayload.reactivatedBy = new Types.ObjectId(adminId);
  }

  const updatedUser = await User.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });

  return {
    id: updatedUser!._id.toString(),
    name: updatedUser!.name,
    email: updatedUser!.email,
    phone: updatedUser!.phone,
    role: updatedUser!.role,
    
    accountState: updatedUser!.accountState,
    reactivatedAt: updatedUser!.reactivatedAt,
    reactivatedBy: updatedUser!.reactivatedBy
      ? updatedUser!.reactivatedBy.toString()
      : adminId || null,
  };
};

const unblockUser = async (id: string, adminId?: string) => {
  return reactivateChauffeur(id, adminId);
};

const getUserById = async (id: string) => {
  const user = await User.findOne({
    _id: id,
    role: { $ne: USER_ROLES.ADMIN },
  }).select('-password -authentication');
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const objectId = new Types.ObjectId(id);

  return {
    user,
    vehicles: [],
    documents: [],
    serviceArea: null,
    subscription: null,
    reviewSummary: { averageRating: 0, totalReviews: 0 }
  };
};

const getMyReviews = async (userId: string) => {
  return {
    reviewSummary: { averageRating: 0, totalReviews: 0 },
    reviews: []
  };
};

const getUserDetailsById = async (
  id: string,
  requesterId?: string,
  requesterRole?: string,
) => {
  let selectFields = '-password -authentication';
  if (requesterRole !== USER_ROLES.ADMIN) {
    selectFields =
      'name email phone serviceArea company  profilePicture averageRating totalReviews createdAt';
  }

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user ID format');
  }

  const objectId = new Types.ObjectId(id);

  const user = await User.findById(id).select(selectFields).lean();
  const vehicles: any[] = [];
  const recentReviews: any[] = [];


  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  return {
    ...user,
    vehicles: vehicles || [],
    reviews: recentReviews || [],
  };
};

const getUserReviews = async (
  userId: string,
  query: Record<string, unknown> = {},
) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user ID format');
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const objectId = new Types.ObjectId(userId);

  let limit = 10;
  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (
      isNaN(parsedLimit) ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit <= 0
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Limit must be a positive integer',
      );
    }
    if (parsedLimit > 50) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Limit cannot exceed 50');
    }
    limit = parsedLimit;
  }

  const rawCursor = query.cursor as string | undefined;
  let cursorData: { reviewedAt?: string; jobId?: string } | null = null;
  if (rawCursor) {
    try {
      cursorData = JSON.parse(
        Buffer.from(rawCursor, 'base64url').toString('utf8'),
      );
    } catch {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor token');
    }
  }

  const reviewStats = [{ averageRating: 0, totalReviews: 0 }];
  const docs: any[] = [];


  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({
        reviewedAt: last.reviewedAt,
        jobId: last.jobId.toString(),
      }),
    ).toString('base64url');
  }

  return {
    reviewSummary: {
      averageRating: reviewStats[0]?.averageRating
        ? Math.round(reviewStats[0].averageRating * 10) / 10
        : targetUser.averageRating || 0,
      totalReviews:
        reviewStats[0]?.totalReviews !== undefined
          ? reviewStats[0].totalReviews
          : targetUser.totalReviews || 0,
    },
    cursor: {
      nextCursor,
      hasMore,
      limit,
    },
    data: items,
  };
};

const deleteAccountFromDB = async (
  userId: string,
  payload: { password: string },
) => {
  const isExistUser = await User.findById(userId).select('+password');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const isMatchPassword = await User.isMatchPassword(
    payload.password,
    isExistUser.password as string,
  );

  if (!isMatchPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password not match!');
  }

  if (isExistUser.profilePicture) unlinkFile(isExistUser.profilePicture);


  // Option 2: Soft delete (set status to DELETE)
  await User.findByIdAndUpdate(userId, {
    accountState: ACCOUNT_STATE.DEACTIVATED,
    $set: { vehicles: [], deviceTokens: [] },
    $unset: {
      email: 1, // Optional: allow re-registration with same email if needed
      phone: 1,
    },
  });

  return { message: 'Account deleted successfully' };
};

const deleteUserByAdmin = async (userId: string, adminId?: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user ID format');
  }

  const isExistUser = await User.findById(userId);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (isExistUser.role === USER_ROLES.ADMIN) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Cannot delete an administrator account via this endpoint',
    );
  }

  if (isExistUser.profilePicture) unlinkFile(isExistUser.profilePicture);

  // Cleanup uploaded compliance documents
  // removed document deletion

  // Hard delete user from MongoDB database
  await User.findByIdAndDelete(userId);

  return null;
};

const searchChauffeurs = async (
  userId: string,
  query: Record<string, unknown> = {},
) => {
  const chauffeurQuery = new CursorQueryBuilder(
    User.find({
      role: USER_ROLES.PROMOTER,
      accountState: { $ne: ACCOUNT_STATE.SUSPENDED },
      _id: { $ne: new Types.ObjectId(userId) },
    }),
    query,
  )
    .cursor('_id', 'desc')
    .search(['name', 'phone'])
    .select(
      'name phone profilePicture averageRating totalReviews serviceArea',
    );

  const result = await chauffeurQuery.execute();

  const data = result.data.map((c: any) => ({
    ...c,
  }));

  return {
    cursor: result.cursor,
    data,
  };
};

const getUserStats = async (): Promise<IUserStats> => {
  const [totalUsers, activeUsers, pendingUsers, suspendedUsers] =
    await Promise.all([
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: { role: USER_ROLES.PROMOTER,},
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: {
          role: USER_ROLES.PROMOTER,
          accountState: ACCOUNT_STATE.VERIFIED,
        },
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: { role: USER_ROLES.PROMOTER },
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: {
          role: USER_ROLES.PROMOTER,
          accountState: ACCOUNT_STATE.SUSPENDED,
        },
        period: 'month',
      }),
    ]);

  const formatMetric = (stat: IStatistic): IUserStatMetric => ({
    count: stat.total,
    growth: stat.growth,
    growthType: stat.growthType,
  });

  const total = formatMetric(totalUsers);
  const active = formatMetric(activeUsers);
  const pending = formatMetric(pendingUsers);
  const suspended = formatMetric(suspendedUsers);

  return {
    period: {
      type: 'monthly',
      comparison: 'previous_period',
    },
    totalUsers: total,
    activeUsers: active,
    pendingUsers: pending,
    suspendedUsers: suspended,
    totalDrivers: total,
    approvedDrivers: active,
    pendingDrivers: pending,
    suspendedDrivers: suspended,
  };
};

const generateTemporaryPassword = (length = 10): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + numbers + special;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return pwd
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
};

const createUserByAdmin = async (
  payload: {
    name: string;
    email: string;
    role?: USER_ROLES;
    phone?: string;
    temporaryPassword?: string;
  },
  adminUser: JwtPayload,
) => {
  const email = payload.email.toLowerCase().trim();
  const isExistUser = await User.findOne({ email });
  if (isExistUser) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'An account with this email address already exists.',
    );
  }

  const temporaryPassword =
    payload.temporaryPassword || generateTemporaryPassword();
  const hashPassword = await bcrypt.hash(
    temporaryPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const role = payload.role || USER_ROLES.PROMOTER;

  const newUser = await User.create({
    name: payload.name.trim(),
    email,
    password: hashPassword,
    role,
    phone: payload.phone || undefined,
    accountState: ACCOUNT_STATE.VERIFIED,
  });

  try {
    // email sending disabled for admin temp password
  } catch (error) {
    logger.error('Failed to send admin-created user credentials email:', error);
  }

  return {
    id: newUser._id.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    phone: newUser.phone,
    accountState: newUser.accountState,
  };
};

export const UserService = {
  getUserProfileFromDB,
  updateProfileToDB,
  getAllUserRoles,
  createUserByAdmin,
  approveChauffeur,
  rejectChauffeur,
  suspendChauffeur,
  suspendUser: suspendChauffeur,
  blockUser,
  reactivateChauffeur,
  reactivateUser: reactivateChauffeur,
  unblockUser,
  getUserById,
  getMyReviews,
  getUserDetailsById,
  getUserReviews,
  deleteAccountFromDB,
  deleteUserByAdmin,
  searchChauffeurs,
  getUserStats,
};
