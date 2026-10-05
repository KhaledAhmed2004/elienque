import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import {
  ACCOUNT_STATE,
  APP_STATE,
  USER_ROLES,
  VEHICLE_STATUS,
  DOCUMENT_TYPE,
} from '../../../enums/user';
import { Types } from 'mongoose';
import { Subscription as SubscriptionModel } from '../subscription/subscription.model';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import unlinkFile from '../../../shared/unlinkFile';
import generateOTP from '../../../util/generateOTP';
import { User } from './user.model';
import { ServiceArea } from '../service-area/service-area.model';
import QueryBuilder from '../../builder/QueryBuilder';
import CursorQueryBuilder from '../../builder/CursorQueryBuilder';
import { IUser, IUserStats, IUserStatMetric } from './user.interface';
import { AnalyticsHelper } from '../../../helpers/analytics';
import { IStatistic } from '../../../helpers/analytics/analytics.types';
import { Job } from '../job/job.model';
import { Vehicle } from '../vehicle/vehicle.model';
import { Document, formatDocumentFileUrl } from '../document/document.model';
import bcrypt from 'bcrypt';
import { adminCreatedUserTemplate } from '../../../helpers/email/templates';
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
    delete userObj.drivingLicense;
    delete userObj.hackLicense;
    delete userObj.localPermit;
    delete userObj.favoriteChauffeurs;
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

    // Detect service area change for community room auto-switch
    const oldServiceArea = isExistUser.serviceArea;
    const newServiceArea = payload.serviceArea;
    const serviceAreaChanged =
      newServiceArea !== undefined &&
      newServiceArea !== null &&
      newServiceArea !== oldServiceArea;

    // Cleanup old personal doc files when new ones are uploaded
    if (payload.profilePicture && isExistUser.profilePicture) {
      unlinkFile(isExistUser.profilePicture);
    }
    if (payload.drivingLicense?.image && isExistUser.drivingLicense?.image) {
      unlinkFile(isExistUser.drivingLicense.image);
    }
    if (payload.hackLicense?.image && isExistUser.hackLicense?.image) {
      unlinkFile(isExistUser.hackLicense.image);
    }
    if (payload.localPermit?.image && isExistUser.localPermit?.image) {
      unlinkFile(isExistUser.localPermit.image);
    }

    const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
      new: true,
    });

    // Server-side community room migration — move all user's sockets without reconnect
    if (serviceAreaChanged) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const io = (global as any).io;
        if (io) {
          const userRoom = `user::${id}`;
          if (oldServiceArea)
            io.in(userRoom).socketsLeave(`community::${oldServiceArea}`);
          if (newServiceArea)
            io.in(userRoom).socketsJoin(`community::${newServiceArea}`);
          io.to(userRoom).emit('SERVICE_AREA_CHANGED', {
            newServiceArea: newServiceArea ?? null,
            oldServiceArea: oldServiceArea ?? null,
          });
        }
      } catch (_err) {
        // Non-fatal: profile update succeeds regardless; next socket connect auto-joins correct room
      }
    }

    if (!updateDoc) return null;

    const userObj = updateDoc.toJSON ? updateDoc.toJSON() : { ...updateDoc };
    if (role !== USER_ROLES.ADMIN) {
      delete (userObj as any).role;
      delete userObj.drivingLicense;
      delete userObj.hackLicense;
      delete userObj.localPermit;
      delete userObj.favoriteChauffeurs;
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
      filterQuery.appState = APP_STATE.ACTIVE;
      filterQuery.accountState = { $ne: ACCOUNT_STATE.SUSPENDED };
    } else if (st === 'PENDING') {
      filterQuery.appState = APP_STATE.PENDING;
      filterQuery.accountState = { $ne: ACCOUNT_STATE.SUSPENDED };
    } else if (st === 'REJECTED') {
      filterQuery.appState = APP_STATE.REJECTED;
    }
  }

  const qb = new QueryBuilder(User.find(filterQuery), queryCopy)
    .filter()
    .sort()
    .paginate();

  // Select core fields needed for listing
  const docs = (await qb.modelQuery
    .select(
      '_id name email profilePicture status appState accountState company companyRole role phone createdAt',
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

  // Job stats for creators
  const createdStats = await Job.aggregate([
    { $match: { createdBy: { $in: objectIds } } },
    {
      $group: {
        _id: '$createdBy',
        totalJobsCreated: { $sum: 1 },
        payout: {
          $sum: {
            $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$paymentAmount', 0],
          },
        },
      },
    },
  ]);

  // Job stats for drivers (assignedTo)
  const assignedStats = await Job.aggregate([
    { $match: { assignedTo: { $in: objectIds }, status: 'COMPLETED' } },
    {
      $group: {
        _id: '$assignedTo',
        totalJobsCompleted: { $sum: 1 },
        earnings: { $sum: '$paymentAmount' },
      },
    },
  ]);

  const createdStatsMap = new Map(
    createdStats.map(s => [s._id.toString(), s]),
  );
  const assignedStatsMap = new Map(
    assignedStats.map(s => [s._id.toString(), s]),
  );

  // Compose final response objects
  const data = docs.map(d => {
    const id = d._id?.toString() as string | undefined;
    const cStat = id ? createdStatsMap.get(id) : null;
    const aStat = id ? assignedStatsMap.get(id) : null;
    const sub = id ? subsMap.get(id) : null;

    let computedStatus = 'PENDING';
    if (
      d.accountState === ACCOUNT_STATE.SUSPENDED ||
      d.accountState === 'SUSPENDED'
    ) {
      computedStatus = 'SUSPENDED';
    } else if (d.appState === APP_STATE.ACTIVE || d.appState === 'ACTIVE') {
      computedStatus = 'APPROVED';
    } else if (
      d.appState === APP_STATE.REJECTED ||
      d.appState === 'REJECTED'
    ) {
      computedStatus = 'REJECTED';
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
      companyRole: d.companyRole ?? 'Chauffeur',
      status: computedStatus,
      subscription: sub ? { status: sub.status } : null,
      stats: {
        totalJobsCreated: cStat?.totalJobsCreated || 0,
        totalJobsCompleted: aStat?.totalJobsCompleted || 0,
        payout: cStat?.payout || 0,
        earnings: aStat?.earnings || 0,
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

  let selectedVehicle = user.selectedVehicle;
  if (!selectedVehicle) {
    const userVehicle = await Vehicle.findOne({
      owner: (user as any)._id || id,
    }).sort({
      createdAt: -1,
    });
    if (userVehicle) {
      selectedVehicle = userVehicle._id;
    }
  }

  const now = new Date();
  const updatePayload: any = {
    appState: APP_STATE.ACTIVE,
    accountState: ACCOUNT_STATE.VERIFIED,
    isOnboard: true,
    approvedAt: now,
  };

  if (adminId && Types.ObjectId.isValid(adminId)) {
    updatePayload.approvedBy = new Types.ObjectId(adminId);
  }
  if (selectedVehicle) {
    updatePayload.selectedVehicle = selectedVehicle;
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
    companyRole: updatedUser!.companyRole,
    accountState: updatedUser!.accountState,
    appState: updatedUser!.appState,
    isOnboard: updatedUser!.isOnboard ?? true,
    selectedVehicle: updatedUser!.selectedVehicle
      ? updatedUser!.selectedVehicle.toString()
      : null,
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
    appState: APP_STATE.REJECTED,
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
    companyRole: updatedUser!.companyRole,
    accountState: updatedUser!.accountState,
    appState: updatedUser!.appState,
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
    companyRole: updatedUser!.companyRole,
    accountState: updatedUser!.accountState,
    appState: updatedUser!.appState,
    selectedVehicle: updatedUser!.selectedVehicle
      ? updatedUser!.selectedVehicle.toString()
      : null,
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

  const [reviewStats, vehicles, documents, subscription, serviceArea] =
    await Promise.all([
      Job.aggregate([
        {
          $match: {
            $or: [
              {
                createdBy: objectId,
                'reviewByDriver.rating': { $exists: true },
              },
              {
                assignedTo: objectId,
                'reviewByCreator.rating': { $exists: true },
              },
            ],
          },
        },
        {
          $project: {
            rating: {
              $cond: [
                { $eq: ['$createdBy', objectId] },
                '$reviewByDriver.rating',
                '$reviewByCreator.rating',
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      Vehicle.find({ owner: objectId }).sort({ createdAt: -1 }).lean(),
      Document.find({ userId: objectId }).sort({ createdAt: -1 }).lean(),
      SubscriptionModel.findOne({ userId: objectId }).lean(),
      user.serviceAreaId
        ? ServiceArea.findById(user.serviceAreaId).lean()
        : null,
    ]);

  return {
    user,
    vehicles: vehicles || [],
    documents: (documents || []).map((doc: any) => ({
      ...doc,
      fileUrl: formatDocumentFileUrl(doc.storageKey),
    })),
    serviceArea: serviceArea || null,
    subscription: subscription
      ? { status: subscription.status, plan: (subscription as any).plan }
      : null,
    reviewSummary: {
      averageRating: reviewStats[0]?.averageRating
        ? Math.round(reviewStats[0].averageRating * 10) / 10
        : 0,
      totalReviews: reviewStats[0]?.totalReviews || 0,
    },
  };
};

const getMyReviews = async (userId: string) => {
  const objectId = new Types.ObjectId(userId);

  // Aggregate review stats from both directions
  const reviewStats = await Job.aggregate([
    {
      $match: {
        $or: [
          { createdBy: objectId, 'reviewByDriver.rating': { $exists: true } },
          {
            assignedTo: objectId,
            'reviewByCreator.rating': { $exists: true },
          },
        ],
      },
    },
    {
      $project: {
        rating: {
          $cond: [
            { $eq: ['$createdBy', objectId] },
            '$reviewByDriver.rating',
            '$reviewByCreator.rating',
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  // Reviews received as job creator (from drivers)
  const reviewsAsCreator = await Job.find({
    createdBy: objectId,
    'reviewByDriver.rating': { $exists: true },
  })
    .select('reviewByDriver assignedTo createdAt')
    .populate('assignedTo', 'name profilePicture')
    .sort({ 'reviewByDriver.reviewedAt': -1 })
    .lean();

  // Reviews received as driver (from creators)
  const reviewsAsDriver = await Job.find({
    assignedTo: objectId,
    'reviewByCreator.rating': { $exists: true },
  })
    .select('reviewByCreator createdBy createdAt')
    .populate('createdBy', 'name profilePicture')
    .sort({ 'reviewByCreator.reviewedAt': -1 })
    .lean();

  // Normalize into a single array
  const reviews = [
    ...reviewsAsCreator.map(j => ({
      rating: j.reviewByDriver!.rating,
      comment: j.reviewByDriver!.comment,
      reviewedAt: j.reviewByDriver!.reviewedAt,
      reviewer: j.assignedTo,
      jobId: j._id,
    })),
    ...reviewsAsDriver.map(j => ({
      rating: j.reviewByCreator!.rating,
      comment: j.reviewByCreator!.comment,
      reviewedAt: j.reviewByCreator!.reviewedAt,
      reviewer: j.createdBy,
      jobId: j._id,
    })),
  ].sort(
    (a, b) =>
      new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
  );

  return {
    reviewSummary: {
      averageRating: reviewStats[0]?.averageRating
        ? Math.round(reviewStats[0].averageRating * 10) / 10
        : 0,
      totalReviews: reviewStats[0]?.totalReviews || 0,
    },
    reviews,
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
      'name email phone serviceArea company companyRole profilePicture averageRating totalReviews badges createdAt';
  }

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user ID format');
  }

  const objectId = new Types.ObjectId(id);

  const [user, vehicles, recentReviews] = await Promise.all([
    User.findById(id).select(selectFields).lean(),
    Vehicle.find({ owner: id })
      .select('type makeAndModel -_id')
      .sort({ createdAt: -1 })
      .lean(),
    Job.aggregate([
      {
        $match: {
          $or: [
            {
              createdBy: objectId,
              'reviewByDriver.rating': { $exists: true },
            },
            {
              assignedTo: objectId,
              'reviewByCreator.rating': { $exists: true },
            },
          ],
        },
      },
      {
        $project: {
          jobId: '$_id',
          rating: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$reviewByDriver.rating',
              '$reviewByCreator.rating',
            ],
          },
          comment: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$reviewByDriver.comment',
              '$reviewByCreator.comment',
            ],
          },
          reviewedAt: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$reviewByDriver.reviewedAt',
              '$reviewByCreator.reviewedAt',
            ],
          },
          reviewerId: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$assignedTo',
              '$createdBy',
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewerId',
          foreignField: '_id',
          as: 'reviewer',
        },
      },
      {
        $unwind: {
          path: '$reviewer',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          jobId: 1,
          rating: 1,
          comment: 1,
          reviewedAt: 1,
          reviewer: {
            _id: '$reviewer._id',
            name: '$reviewer.name',
            profilePicture: '$reviewer.profilePicture',
          },
        },
      },
      { $sort: { reviewedAt: -1, jobId: -1 } },
      { $limit: 5 },
    ]),
  ]);

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  let isFavorite = false;
  if (requesterId) {
    const requester = await User.findById(requesterId)
      .select('favoriteChauffeurs')
      .lean();
    const favList = (requester?.favoriteChauffeurs || []).map(fId =>
      fId.toString(),
    );
    isFavorite = favList.includes(user._id.toString());
  }

  const badges =
    Array.isArray((user as any).badges) && (user as any).badges.length > 0
      ? (user as any).badges
      : (user as any).averageRating >= 4.8 && (user as any).totalReviews >= 10
        ? ['Top Rated']
        : [];

  return {
    ...user,
    vehicles: vehicles || [],
    reviews: recentReviews || [],
    isFavorite,
    badges,
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

  const matchFilter: any = {
    $or: [
      { createdBy: objectId, 'reviewByDriver.rating': { $exists: true } },
      { assignedTo: objectId, 'reviewByCreator.rating': { $exists: true } },
    ],
  };

  const pipeline: any[] = [
    { $match: matchFilter },
    {
      $project: {
        jobId: '$_id',
        rating: {
          $cond: [
            { $eq: ['$createdBy', objectId] },
            '$reviewByDriver.rating',
            '$reviewByCreator.rating',
          ],
        },
        comment: {
          $cond: [
            { $eq: ['$createdBy', objectId] },
            '$reviewByDriver.comment',
            '$reviewByCreator.comment',
          ],
        },
        reviewedAt: {
          $cond: [
            { $eq: ['$createdBy', objectId] },
            '$reviewByDriver.reviewedAt',
            '$reviewByCreator.reviewedAt',
          ],
        },
        reviewerId: {
          $cond: [
            { $eq: ['$createdBy', objectId] },
            '$assignedTo',
            '$createdBy',
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'reviewerId',
        foreignField: '_id',
        as: 'reviewer',
      },
    },
    {
      $unwind: {
        path: '$reviewer',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        jobId: 1,
        rating: 1,
        comment: 1,
        reviewedAt: 1,
        reviewer: {
          _id: '$reviewer._id',
          name: '$reviewer.name',
          profilePicture: '$reviewer.profilePicture',
        },
      },
    },
  ];

  if (cursorData && cursorData.reviewedAt) {
    const cursorDate = new Date(cursorData.reviewedAt);
    pipeline.push({
      $match: {
        $or: [
          { reviewedAt: { $lt: cursorDate } },
          {
            reviewedAt: cursorDate,
            jobId: { $lt: new Types.ObjectId(cursorData.jobId) },
          },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { reviewedAt: -1, jobId: -1 } },
    { $limit: limit + 1 },
  );

  const [reviewStats, docs] = await Promise.all([
    Job.aggregate([
      { $match: matchFilter },
      {
        $project: {
          rating: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$reviewByDriver.rating',
              '$reviewByCreator.rating',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]),
    Job.aggregate(pipeline),
  ]);

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

  // Cleanup personal files
  if (isExistUser.profilePicture) unlinkFile(isExistUser.profilePicture);
  if (isExistUser.drivingLicense?.image)
    unlinkFile(isExistUser.drivingLicense.image);
  if (isExistUser.hackLicense?.image)
    unlinkFile(isExistUser.hackLicense.image);
  if (isExistUser.localPermit?.image)
    unlinkFile(isExistUser.localPermit.image);

  // Cleanup vehicle files
  const userVehicles = await Vehicle.find({ owner: userId });
  userVehicles.forEach((v: any) => {
    if (v.vehicleRegistration?.image) unlinkFile(v.vehicleRegistration.image);
    if (v.commercialInsurance?.image) unlinkFile(v.commercialInsurance.image);
    if (v.photos) {
      if (v.photos.frontView) unlinkFile(v.photos.frontView);
      if (v.photos.rearView) unlinkFile(v.photos.rearView);
      if (v.photos.interiorView) unlinkFile(v.photos.interiorView);
    }
  });

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

  // Cleanup personal files
  if (isExistUser.profilePicture) unlinkFile(isExistUser.profilePicture);
  if (isExistUser.drivingLicense?.image)
    unlinkFile(isExistUser.drivingLicense.image);
  if (isExistUser.hackLicense?.image)
    unlinkFile(isExistUser.hackLicense.image);
  if (isExistUser.localPermit?.image)
    unlinkFile(isExistUser.localPermit.image);

  // Cleanup vehicle files & records
  const userVehicles = await Vehicle.find({ owner: userId });
  userVehicles.forEach((v: any) => {
    if (v.vehicleRegistration?.image) unlinkFile(v.vehicleRegistration.image);
    if (v.commercialInsurance?.image) unlinkFile(v.commercialInsurance.image);
    if (v.photos) {
      if (v.photos.frontView) unlinkFile(v.photos.frontView);
      if (v.photos.rearView) unlinkFile(v.photos.rearView);
      if (v.photos.interiorView) unlinkFile(v.photos.interiorView);
    }
  });
  await Vehicle.deleteMany({ owner: userId });

  // Cleanup uploaded compliance documents
  await Document.deleteMany({ owner: userId });

  // Hard delete user from MongoDB database
  await User.findByIdAndDelete(userId);

  return null;
};

const addFavoriteChauffeur = async (userId: string, chauffeurId: string) => {
  if (!Types.ObjectId.isValid(chauffeurId)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid chauffeur ID format',
    );
  }

  if (userId.toString() === chauffeurId.toString()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You cannot add yourself to favorite chauffeurs',
    );
  }

  const chauffeur = await User.findById(chauffeurId);
  if (!chauffeur) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chauffeur not found');
  }

  if (chauffeur.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Cannot add a suspended chauffeur to favorites',
    );
  }

  // Check if chauffeur is already in favorites
  const currentUser =
    await User.findById(userId).select('favoriteChauffeurs');
  if (!currentUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const isAlreadyFavorite = (currentUser.favoriteChauffeurs || []).some(
    (id: any) => id.toString() === chauffeurId.toString(),
  );

  // Atomic $addToSet ensures DB-level uniqueness and concurrency safety
  await User.findByIdAndUpdate(
    userId,
    { $addToSet: { favoriteChauffeurs: new Types.ObjectId(chauffeurId) } },
    { new: true },
  );

  return {
    isAlreadyFavorite,
    data: {
      _id: chauffeur._id.toString(),
      name: chauffeur.name,
      isFavorite: true,
    },
  };
};

const removeFavoriteChauffeur = async (userId: string, chauffeurId: string) => {
  if (!Types.ObjectId.isValid(chauffeurId)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid chauffeur ID format',
    );
  }

  const chauffeur = await User.findById(chauffeurId);
  if (!chauffeur) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chauffeur not found');
  }

  await User.findByIdAndUpdate(
    userId,
    { $pull: { favoriteChauffeurs: new Types.ObjectId(chauffeurId) } },
    { new: true },
  );

  return {
    _id: chauffeur._id.toString(),
    name: chauffeur.name,
    isFavorite: false,
  };
};

const getFavoriteChauffeurs = async (
  userId: string,
  query: Record<string, unknown> = {},
) => {
  const currentUser =
    await User.findById(userId).select('favoriteChauffeurs');
  const favoriteIds = currentUser?.favoriteChauffeurs || [];
  const validFavoriteObjectIds = favoriteIds
    .filter((id: any) => Types.ObjectId.isValid(id.toString()))
    .map((id: any) => new Types.ObjectId(id.toString()));

  if (!validFavoriteObjectIds.length) {
    return {
      cursor: {
        nextCursor: null,
        hasMore: false,
        limit: Math.min(
          Number(query.limit) > 0 ? Number(query.limit) : 10,
          50,
        ),
      },
      data: [],
    };
  }

  const favoriteQuery = new CursorQueryBuilder(
    User.find({ _id: { $in: validFavoriteObjectIds } }),
    query,
  )
    .cursor('_id', 'desc')
    .search(['name', 'phone'])
    .select(
      'name phone profilePicture averageRating totalReviews serviceArea badges',
    );

  const result = await favoriteQuery.execute();

  const data = result.data.map((c: any) => ({
    ...c,
    isFavorite: true,
    badges:
      Array.isArray(c.badges) && c.badges.length > 0
        ? c.badges
        : c.averageRating >= 4.8 && c.totalReviews >= 10
          ? ['Top Rated']
          : [],
  }));

  return {
    cursor: result.cursor,
    data,
  };
};

const searchChauffeurs = async (
  userId: string,
  query: Record<string, unknown> = {},
) => {
  const chauffeurQuery = new CursorQueryBuilder(
    User.find({
      role: USER_ROLES.USER,
      accountState: { $ne: ACCOUNT_STATE.SUSPENDED },
      _id: { $ne: new Types.ObjectId(userId) },
    }),
    query,
  )
    .cursor('_id', 'desc')
    .search(['name', 'phone'])
    .select(
      'name phone profilePicture averageRating totalReviews serviceArea badges',
    );

  const result = await chauffeurQuery.execute();

  // Fetch current user's favorite chauffeurs list for dynamic flag
  const currentUser =
    await User.findById(userId).select('favoriteChauffeurs');
  const favSet = new Set(
    (currentUser?.favoriteChauffeurs || []).map(id => id.toString()),
  );

  const data = result.data.map((c: any) => ({
    ...c,
    isFavorite: favSet.has(c._id.toString()),
    badges:
      Array.isArray(c.badges) && c.badges.length > 0
        ? c.badges
        : c.averageRating >= 4.8 && c.totalReviews >= 10
          ? ['Top Rated']
          : [],
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
        filter: { role: USER_ROLES.USER },
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: {
          role: USER_ROLES.USER,
          appState: APP_STATE.ACTIVE,
          accountState: ACCOUNT_STATE.VERIFIED,
        },
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: { role: USER_ROLES.USER, appState: APP_STATE.PENDING },
        period: 'month',
      }),
      new AnalyticsHelper(User as any).calculateGrowth({
        filter: {
          role: USER_ROLES.USER,
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
    appState: APP_STATE.ACTIVE,
    mustChangePassword: true,
  });

  try {
    const emailData = adminCreatedUserTemplate({
      name: newUser.name,
      email: newUser.email,
      temporaryPassword,
    });
    await emailHelper.sendEmail(emailData);
  } catch (error) {
    logger.error('Failed to send admin-created user credentials email:', error);
  }

  return {
    id: newUser._id.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    phone: newUser.phone,
    appState: newUser.appState,
    accountState: newUser.accountState,
    mustChangePassword: newUser.mustChangePassword,
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
  addFavoriteChauffeur,
  removeFavoriteChauffeur,
  getFavoriteChauffeurs,
  searchChauffeurs,
  getUserStats,
};
