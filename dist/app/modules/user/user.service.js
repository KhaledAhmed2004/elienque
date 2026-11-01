"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const http_status_codes_1 = require("http-status-codes");
const client_1 = require("@prisma/client");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const prisma_1 = require("../../../shared/prisma");
const builder_1 = require("../../builder");
const session_service_1 = require("../session/session.service");
const bcrypt_1 = __importDefault(require("bcrypt"));
const config_1 = __importDefault(require("../../../config"));
// ==========================================
// Core NestJS UsersService Implementation
// ==========================================
const create = async (data) => {
    return prisma_1.prisma.user.create({ data });
};
const findByEmail = async (email) => {
    return prisma_1.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
            operatorProfile: true,
        },
    });
};
const findById = async (id) => {
    return prisma_1.prisma.user.findUnique({
        where: { id },
        include: {
            operatorProfile: true,
        },
    });
};
const update = async (id, data) => {
    return prisma_1.prisma.user.update({
        where: { id },
        data,
    });
};
// ==========================================
// NestJS UsersController Business Logic
// ==========================================
const getAdminDashboard = async () => {
    return { message: 'Welcome to the secret admin dashboard!' };
};
const getProfile = async (userId) => {
    const user = await findById(userId);
    if (!user || user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    // Exclude sensitive information like passwordHash and deletedAt
    const { passwordHash: _passwordHash, deletedAt: _deletedAt, ...safeUser } = user;
    return safeUser;
};
const updateProfile = async (userId, payload) => {
    const existing = await findById(userId);
    if (!existing || existing.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const phone = payload.phoneNumber || payload.phone;
    const updateData = {};
    if (payload.name !== undefined && payload.name.trim()) {
        updateData.name = payload.name.trim();
    }
    if (payload.email !== undefined && payload.email.trim()) {
        const trimmedEmail = payload.email.trim().toLowerCase();
        if (trimmedEmail !== existing.email.toLowerCase()) {
            const emailConflict = await prisma_1.prisma.user.findFirst({
                where: { email: trimmedEmail, id: { not: userId } },
            });
            if (emailConflict) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email is already in use by another account');
            }
            updateData.email = trimmedEmail;
        }
    }
    if (phone !== undefined) {
        updateData.phoneNumber = phone ? phone.trim() : null;
    }
    const isOperator = existing.role === client_1.Role.OPERATOR;
    if (isOperator && (payload.companyName || payload.contactPersonName)) {
        updateData.operatorProfile = {
            upsert: {
                create: {
                    companyName: payload.companyName?.trim() || existing.operatorProfile?.companyName || '',
                    contactPersonName: payload.contactPersonName?.trim() || existing.operatorProfile?.contactPersonName || '',
                },
                update: {
                    ...(payload.companyName && { companyName: payload.companyName.trim() }),
                    ...(payload.contactPersonName && { contactPersonName: payload.contactPersonName.trim() }),
                },
            },
        };
    }
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
            operatorProfile: true,
        },
    });
    const { passwordHash: _passwordHash, deletedAt: _deletedAt, ...safeUser } = updatedUser;
    return {
        message: 'Profile updated successfully',
        user: safeUser,
    };
};
const updatePassword = async (userId, payload) => {
    const oldPassword = payload.oldPassword || payload.currentPassword;
    if (!oldPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect old password');
    }
    const user = await findById(userId);
    if (!user || user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const isValid = await bcrypt_1.default.compare(oldPassword, user.passwordHash);
    if (!isValid) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect old password');
    }
    const newPasswordHash = await bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds) || 12);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
    });
    // Important: Revoke all other sessions after a password change to ensure security
    await session_service_1.SessionService.revokeAllUserSessions(user.id, session_service_1.RevocationReason.PASSWORD_CHANGED);
    return {
        message: 'Password updated successfully. All devices have been logged out. Please log in again.',
    };
};
const getUserSessions = async (userId) => {
    const sessions = await session_service_1.SessionService.findUserSessions(userId);
    // Omit sensitive refresh token hash from the response
    return sessions.map((session) => {
        const { refreshTokenHash: _refreshTokenHash, ...safeSession } = session;
        return safeSession;
    });
};
const revokeSession = async (userId, sessionId) => {
    // Ensure the session belongs to the user
    const sessions = await session_service_1.SessionService.findUserSessions(userId);
    const sessionExists = sessions.find((s) => s.id === sessionId);
    if (!sessionExists) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Session not found or already revoked');
    }
    await session_service_1.SessionService.revokeSession(sessionId, session_service_1.RevocationReason.USER_REVOKED);
    return { message: 'Session revoked successfully' };
};
// ==========================================
// Platform Admin User Management (Tier 3)
// ==========================================
const getAllUsers = async (query) => {
    const roleFilter = query.role
        ? String(query.role).toUpperCase()
        : undefined;
    const statusFilter = query.status
        ? String(query.status).toUpperCase()
        : undefined;
    const userQuery = new builder_1.PrismaQueryBuilder(prisma_1.prisma.user, query, 'User')
        .search(['name', 'email', 'phoneNumber', 'operatorProfile.companyName'])
        .filter({ customExcludes: ['role', 'status'] })
        .where({
        deletedAt: null,
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
    })
        .include({
        operatorProfile: true,
    })
        .dateFilter('createdAt')
        .sort('-createdAt', ['createdAt', 'name', 'email'])
        .paginate();
    const { data: users, pagination } = await userQuery.execute();
    const data = users.map((u) => {
        const { passwordHash: _hash, ...safe } = u;
        return safe;
    });
    return {
        pagination,
        data,
    };
};
const getUserById = async (id) => {
    const user = await findById(id);
    if (!user || user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const { passwordHash: _hash, ...safeUser } = user;
    return safeUser;
};
const updateUserStatus = async (id, status, _reason, _adminId) => {
    const user = await findById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id },
        data: { status },
        include: { operatorProfile: true },
    });
    if (status === client_1.AccountStatus.SUSPENDED || status === client_1.AccountStatus.DEACTIVATED) {
        await session_service_1.SessionService.revokeAllUserSessions(id, session_service_1.RevocationReason.USER_REVOKED);
    }
    const { passwordHash: _hash, ...safeUser } = updated;
    return safeUser;
};
const suspendUser = async (id, reason, adminId) => {
    return updateUserStatus(id, client_1.AccountStatus.SUSPENDED, reason, adminId);
};
const reactivateUser = async (id, adminId) => {
    return updateUserStatus(id, client_1.AccountStatus.ACTIVE, undefined, adminId);
};
const deleteAccountFromDB = async (userId, payload) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const password = payload?.password;
    if (password && user.passwordHash) {
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect password');
        }
    }
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            deletedAt: new Date(),
            status: client_1.AccountStatus.DEACTIVATED,
        },
    });
    await session_service_1.SessionService.revokeAllUserSessions(userId, session_service_1.RevocationReason.USER_REVOKED);
    return { message: 'Account deleted successfully' };
};
const deleteUserByAdmin = async (userId) => {
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            deletedAt: new Date(),
            status: client_1.AccountStatus.DEACTIVATED,
        },
    });
    await session_service_1.SessionService.revokeAllUserSessions(userId, session_service_1.RevocationReason.USER_REVOKED);
    return { message: 'User deleted by admin successfully' };
};
const getUserStats = async () => {
    const [totalUsers, totalOperators, totalAdmins] = await Promise.all([
        prisma_1.prisma.user.count({ where: { role: client_1.Role.USER, deletedAt: null } }),
        prisma_1.prisma.user.count({ where: { role: client_1.Role.OPERATOR, deletedAt: null } }),
        prisma_1.prisma.user.count({ where: { role: client_1.Role.ADMIN, deletedAt: null } }),
    ]);
    return {
        totalUsers,
        totalOperators,
        totalAdmins,
    };
};
const createUserByAdmin = async (payload) => {
    const email = payload.email.toLowerCase().trim();
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already in use');
    }
    const passwordHash = await bcrypt_1.default.hash(payload.password || 'TempPassword123!', 12);
    const isOperator = payload.role === client_1.Role.OPERATOR;
    const role = isOperator ? client_1.Role.OPERATOR : (payload.role === client_1.Role.ADMIN ? client_1.Role.ADMIN : client_1.Role.USER);
    const newUser = await prisma_1.prisma.user.create({
        data: {
            name: payload.name || '',
            email,
            phoneNumber: payload.phoneNumber || payload.phone || null,
            passwordHash,
            role,
            status: client_1.AccountStatus.ACTIVE,
            isEmailVerified: true,
            ...(isOperator && (payload.companyName || payload.contactPersonName)
                ? {
                    operatorProfile: {
                        create: {
                            companyName: (payload.companyName || payload.name || '').trim(),
                            contactPersonName: (payload.contactPersonName || payload.name || '').trim(),
                        },
                    },
                }
                : {}),
        },
        include: {
            operatorProfile: true,
        },
    });
    const { passwordHash: _hash, ...safeUser } = newUser;
    return safeUser;
};
exports.UserService = {
    create,
    findByEmail,
    findById,
    update,
    getAdminDashboard,
    getProfile,
    updateProfile,
    updatePassword,
    getUserSessions,
    revokeSession,
    getAllUsers,
    getAllUserRoles: getAllUsers,
    getUserById,
    getUserDetailsById: getUserById,
    updateUserStatus,
    suspendUser,
    blockUser: suspendUser,
    reactivateUser,
    unblockUser: reactivateUser,
    approveUser: reactivateUser,
    rejectUser: suspendUser,
    deleteAccountFromDB,
    deleteUserByAdmin,
    getUserStats,
    createUserByAdmin,
    // Backward compatibility
    getUserProfileFromDB: async (user) => {
        const userId = user.id || user.userId || user._id;
        return getProfile(userId);
    },
    updateProfileToDB: async (user, payload) => {
        const userId = user.id || user.userId || user._id;
        return updateProfile(userId, payload);
    },
};
//# sourceMappingURL=user.service.js.map