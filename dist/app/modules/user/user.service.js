"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const mongoose_1 = require("mongoose");
const subscription_model_1 = require("../subscription/subscription.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const user_model_1 = require("./user.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const CursorQueryBuilder_1 = __importDefault(require("../../builder/CursorQueryBuilder"));
const analytics_1 = require("../../../helpers/analytics");
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("../../../shared/logger");
const config_1 = __importDefault(require("../../../config"));
const getUserProfileFromDB = async (user) => {
    const { id, role } = user;
    const isExistUser = await user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const userObj = isExistUser.toJSON
        ? isExistUser.toJSON()
        : { ...isExistUser };
    // Normal users do not see internal role, license document objects, ratings, or favorite arrays in their self-profile
    // Admin has full visibility
    if (role !== user_1.USER_ROLES.ADMIN) {
        delete userObj.role;
        delete userObj.averageRating;
        delete userObj.totalReviews;
        delete userObj.uploadedHeadshot;
    }
    return userObj;
};
const updateProfileToDB = async (user, payload) => {
    const { id, role } = user;
    const isExistUser = await user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (payload.profilePicture && isExistUser.profilePicture) {
        (0, unlinkFile_1.default)(isExistUser.profilePicture);
    }
    const updateDoc = await user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    });
    if (!updateDoc)
        return null;
    const userObj = updateDoc.toJSON ? updateDoc.toJSON() : { ...updateDoc };
    if (role !== user_1.USER_ROLES.ADMIN) {
        delete userObj.role;
        delete userObj.averageRating;
        delete userObj.totalReviews;
        delete userObj.uploadedHeadshot;
    }
    return userObj;
};
const getAllUserRoles = async (query) => {
    const queryCopy = { ...query };
    const filterQuery = queryCopy.role
        ? { role: queryCopy.role }
        : { role: { $ne: user_1.USER_ROLES.ADMIN } };
    delete queryCopy.role;
    if (queryCopy.status) {
        const st = String(queryCopy.status).toUpperCase();
        delete queryCopy.status;
        if (st === 'SUSPENDED') {
            filterQuery.accountState = user_1.ACCOUNT_STATE.SUSPENDED;
        }
        else if (st === 'APPROVED' || st === 'ACTIVE') {
            filterQuery.accountState = { $ne: user_1.ACCOUNT_STATE.SUSPENDED };
        }
        else if (st === 'PENDING') {
            filterQuery.accountState = user_1.ACCOUNT_STATE.UNVERIFIED;
        }
        else if (st === 'REJECTED') {
            // No appState anymore
        }
    }
    const qb = new QueryBuilder_1.default(user_model_1.User.find(filterQuery), queryCopy)
        .filter()
        .sort()
        .paginate();
    // Select core fields needed for listing
    const docs = (await qb.modelQuery
        .select('_id name email profilePicture status accountState company  role phone createdAt')
        .lean());
    const paginationInfo = await qb.getPaginationInfo();
    // Build id arrays for lookups
    const idStrings = docs
        .map(d => (d._id ? d._id.toString() : null))
        .filter(Boolean);
    // Subscription per user
    const objectIds = idStrings.map(id => new mongoose_1.Types.ObjectId(id));
    const subs = await subscription_model_1.Subscription.find({ userId: { $in: objectIds } })
        .select('userId plan status currentPeriodEnd')
        .lean();
    const subsMap = new Map();
    for (const s of subs) {
        subsMap.set(s.userId.toString(), {
            plan: s.plan,
            status: s.status,
            currentPeriodEnd: s.currentPeriodEnd ?? null,
        });
    }
    // Compose final response objects
    const data = docs.map(d => {
        const id = d._id?.toString();
        const sub = id ? subsMap.get(id) : null;
        let computedStatus = 'PENDING';
        if (d.accountState === user_1.ACCOUNT_STATE.SUSPENDED ||
            d.accountState === 'SUSPENDED') {
            computedStatus = 'SUSPENDED';
        }
        else if (d.accountState === user_1.ACCOUNT_STATE.VERIFIED || d.accountState === 'VERIFIED') {
            computedStatus = 'APPROVED';
        }
        else if (d.status) {
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
const approveChauffeur = async (id, adminId) => {
    const user = await user_model_1.User.isExistUserById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const now = new Date();
    const updatePayload = {
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
        approvedAt: now,
    };
    if (adminId && mongoose_1.Types.ObjectId.isValid(adminId)) {
        updatePayload.approvedBy = new mongoose_1.Types.ObjectId(adminId);
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(id, updatePayload, {
        new: true,
    });
    if (updatedUser) {
        const loginUrl = `${config_1.default.frontend_url || 'http://localhost:3000'}/login`;
        const approvalTemplate = emailTemplate_1.emailTemplate.accountApproved({
            name: updatedUser.name,
            email: updatedUser.email,
            loginUrl,
        });
        emailHelper_1.emailHelper.sendEmail(approvalTemplate);
    }
    return {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        accountState: updatedUser.accountState,
        approvedAt: updatedUser.approvedAt,
        approvedBy: updatedUser.approvedBy
            ? updatedUser.approvedBy.toString()
            : adminId || null,
    };
};
const rejectChauffeur = async (id, reason, adminId) => {
    const user = await user_model_1.User.isExistUserById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const now = new Date();
    const rejectionReasonText = reason || 'Application rejected by platform administration';
    const updatePayload = {
        rejectionReason: rejectionReasonText,
        rejectedAt: now,
    };
    if (adminId && mongoose_1.Types.ObjectId.isValid(adminId)) {
        updatePayload.rejectedBy = new mongoose_1.Types.ObjectId(adminId);
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(id, updatePayload, {
        new: true,
    });
    return {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        accountState: updatedUser.accountState,
        reason: updatedUser.rejectionReason,
        rejectedAt: updatedUser.rejectedAt,
        rejectedBy: updatedUser.rejectedBy
            ? updatedUser.rejectedBy.toString()
            : adminId || null,
    };
};
const suspendChauffeur = async (id, reason, adminId) => {
    const user = await user_model_1.User.isExistUserById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const now = new Date();
    const updatePayload = {
        accountState: user_1.ACCOUNT_STATE.SUSPENDED,
        blockReason: reason ?? null,
        suspendedAt: now,
    };
    if (adminId && mongoose_1.Types.ObjectId.isValid(adminId)) {
        updatePayload.suspendedBy = new mongoose_1.Types.ObjectId(adminId);
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(id, updatePayload, {
        new: true,
    });
    return {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        reason: updatedUser.blockReason || reason || null,
        suspendedBy: updatedUser.suspendedBy
            ? updatedUser.suspendedBy.toString()
            : adminId || null,
        suspendedAt: updatedUser.suspendedAt,
    };
};
const blockUser = async (id, reason, adminId) => {
    return suspendChauffeur(id, reason, adminId);
};
const reactivateChauffeur = async (id, adminId) => {
    const user = await user_model_1.User.isExistUserById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const now = new Date();
    const updatePayload = {
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
        blockReason: null,
        reactivatedAt: now,
    };
    if (adminId && mongoose_1.Types.ObjectId.isValid(adminId)) {
        updatePayload.reactivatedBy = new mongoose_1.Types.ObjectId(adminId);
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(id, updatePayload, {
        new: true,
    });
    return {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        accountState: updatedUser.accountState,
        reactivatedAt: updatedUser.reactivatedAt,
        reactivatedBy: updatedUser.reactivatedBy
            ? updatedUser.reactivatedBy.toString()
            : adminId || null,
    };
};
const unblockUser = async (id, adminId) => {
    return reactivateChauffeur(id, adminId);
};
const getUserById = async (id) => {
    const user = await user_model_1.User.findOne({
        _id: id,
        role: { $ne: user_1.USER_ROLES.ADMIN },
    }).select('-password -authentication');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const objectId = new mongoose_1.Types.ObjectId(id);
    return {
        user,
        vehicles: [],
        documents: [],
        serviceArea: null,
        subscription: null,
        reviewSummary: { averageRating: 0, totalReviews: 0 }
    };
};
const getMyReviews = async (userId) => {
    return {
        reviewSummary: { averageRating: 0, totalReviews: 0 },
        reviews: []
    };
};
const getUserDetailsById = async (id, requesterId, requesterRole) => {
    let selectFields = '-password -authentication';
    if (requesterRole !== user_1.USER_ROLES.ADMIN) {
        selectFields =
            'name email phone serviceArea company  profilePicture averageRating totalReviews createdAt';
    }
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid user ID format');
    }
    const objectId = new mongoose_1.Types.ObjectId(id);
    const user = await user_model_1.User.findById(id).select(selectFields).lean();
    const vehicles = [];
    const recentReviews = [];
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return {
        ...user,
        vehicles: vehicles || [],
        reviews: recentReviews || [],
    };
};
const getUserReviews = async (userId, query = {}) => {
    if (!mongoose_1.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid user ID format');
    }
    const targetUser = await user_model_1.User.findById(userId);
    if (!targetUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const objectId = new mongoose_1.Types.ObjectId(userId);
    let limit = 10;
    if (query.limit !== undefined) {
        const parsedLimit = Number(query.limit);
        if (isNaN(parsedLimit) ||
            !Number.isInteger(parsedLimit) ||
            parsedLimit <= 0) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Limit must be a positive integer');
        }
        if (parsedLimit > 50) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Limit cannot exceed 50');
        }
        limit = parsedLimit;
    }
    const rawCursor = query.cursor;
    let cursorData = null;
    if (rawCursor) {
        try {
            cursorData = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
        }
        catch {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor token');
        }
    }
    const reviewStats = [{ averageRating: 0, totalReviews: 0 }];
    const docs = [];
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    let nextCursor = null;
    if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = Buffer.from(JSON.stringify({
            reviewedAt: last.reviewedAt,
            jobId: last.jobId.toString(),
        })).toString('base64url');
    }
    return {
        reviewSummary: {
            averageRating: reviewStats[0]?.averageRating
                ? Math.round(reviewStats[0].averageRating * 10) / 10
                : targetUser.averageRating || 0,
            totalReviews: reviewStats[0]?.totalReviews !== undefined
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
const deleteAccountFromDB = async (userId, payload) => {
    const isExistUser = await user_model_1.User.findById(userId).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const isMatchPassword = await user_model_1.User.isMatchPassword(payload.password, isExistUser.password);
    if (!isMatchPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password not match!');
    }
    if (isExistUser.profilePicture)
        (0, unlinkFile_1.default)(isExistUser.profilePicture);
    // Option 2: Soft delete (set status to DELETE)
    await user_model_1.User.findByIdAndUpdate(userId, {
        accountState: user_1.ACCOUNT_STATE.DEACTIVATED,
        $set: { vehicles: [], deviceTokens: [] },
        $unset: {
            email: 1, // Optional: allow re-registration with same email if needed
            phone: 1,
        },
    });
    return { message: 'Account deleted successfully' };
};
const deleteUserByAdmin = async (userId, adminId) => {
    if (!mongoose_1.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid user ID format');
    }
    const isExistUser = await user_model_1.User.findById(userId);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (isExistUser.role === user_1.USER_ROLES.ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Cannot delete an administrator account via this endpoint');
    }
    if (isExistUser.profilePicture)
        (0, unlinkFile_1.default)(isExistUser.profilePicture);
    // Cleanup uploaded compliance documents
    // removed document deletion
    // Hard delete user from MongoDB database
    await user_model_1.User.findByIdAndDelete(userId);
    return null;
};
const searchChauffeurs = async (userId, query = {}) => {
    const chauffeurQuery = new CursorQueryBuilder_1.default(user_model_1.User.find({
        role: user_1.USER_ROLES.PROMOTER,
        accountState: { $ne: user_1.ACCOUNT_STATE.SUSPENDED },
        _id: { $ne: new mongoose_1.Types.ObjectId(userId) },
    }), query)
        .cursor('_id', 'desc')
        .search(['name', 'phone'])
        .select('name phone profilePicture averageRating totalReviews serviceArea');
    const result = await chauffeurQuery.execute();
    const data = result.data.map((c) => ({
        ...c,
    }));
    return {
        cursor: result.cursor,
        data,
    };
};
const getUserStats = async () => {
    const [totalUsers, activeUsers, pendingUsers, suspendedUsers] = await Promise.all([
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            filter: { role: user_1.USER_ROLES.PROMOTER, },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            filter: {
                role: user_1.USER_ROLES.PROMOTER,
                accountState: user_1.ACCOUNT_STATE.VERIFIED,
            },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            filter: { role: user_1.USER_ROLES.PROMOTER },
            period: 'month',
        }),
        new analytics_1.AnalyticsHelper(user_model_1.User).calculateGrowth({
            filter: {
                role: user_1.USER_ROLES.PROMOTER,
                accountState: user_1.ACCOUNT_STATE.SUSPENDED,
            },
            period: 'month',
        }),
    ]);
    const formatMetric = (stat) => ({
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
const generateTemporaryPassword = (length = 10) => {
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
const createUserByAdmin = async (payload, adminUser) => {
    const email = payload.email.toLowerCase().trim();
    const isExistUser = await user_model_1.User.findOne({ email });
    if (isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'An account with this email address already exists.');
    }
    const temporaryPassword = payload.temporaryPassword || generateTemporaryPassword();
    const hashPassword = await bcrypt_1.default.hash(temporaryPassword, Number(config_1.default.bcrypt_salt_rounds));
    const role = payload.role || user_1.USER_ROLES.PROMOTER;
    const newUser = await user_model_1.User.create({
        name: payload.name.trim(),
        email,
        password: hashPassword,
        role,
        phone: payload.phone || undefined,
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
    });
    try {
        // email sending disabled for admin temp password
    }
    catch (error) {
        logger_1.logger.error('Failed to send admin-created user credentials email:', error);
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
exports.UserService = {
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
//# sourceMappingURL=user.service.js.map