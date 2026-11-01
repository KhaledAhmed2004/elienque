"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const prisma_1 = require("../../../shared/prisma");
const user_1 = require("../../../enums/user");
const client_1 = require("@prisma/client");
const session_service_1 = require("../session/session.service");
const email_1 = require("../../../helpers/email");
const generateNumericOtp = (length = 6) => {
    return Array.from({ length }, () => crypto_1.default.randomInt(0, 10)).join('');
};
const generateSecureToken = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
const registerUser = async (payload) => {
    const email = payload.email.toLowerCase().trim();
    const phone = payload.phoneNumber || payload.phone || null;
    // 1. Check if user already exists
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (existingUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already in use');
    }
    // 2. Hash password
    const hashedPassword = await bcrypt_1.default.hash(payload.password, Number(config_1.default.bcrypt_salt_rounds) || 12);
    const isOperator = payload.role === client_1.Role.OPERATOR ||
        payload.role === user_1.USER_ROLES.OPERATOR;
    const role = isOperator ? client_1.Role.OPERATOR : client_1.Role.USER;
    const displayName = payload.name?.trim() ||
        payload.contactPersonName?.trim() ||
        payload.companyName?.trim() ||
        payload.businessName?.trim() ||
        '';
    // 3. Create user in database (Prisma PostgreSQL)
    const user = await prisma_1.prisma.user.create({
        data: {
            name: displayName,
            email,
            phoneNumber: phone,
            passwordHash: hashedPassword,
            role,
            status: client_1.AccountStatus.UNVERIFIED,
            isEmailVerified: false,
            ...(isOperator && (payload.companyName || payload.contactPersonName)
                ? {
                    operatorProfile: {
                        create: {
                            companyName: (payload.companyName || payload.businessName || displayName).trim(),
                            contactPersonName: (payload.contactPersonName || displayName).trim(),
                        },
                    },
                }
                : {}),
        },
        include: {
            operatorProfile: true,
        },
    });
    // 4. Generate 6-digit numeric OTP
    const otp = generateNumericOtp(6);
    const tokenHash = await bcrypt_1.default.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    // 5. Store verification token
    await prisma_1.prisma.verificationToken.create({
        data: {
            userId: user.id,
            tokenHash,
            type: client_1.TokenType.EMAIL_VERIFICATION,
            expiresAt,
        },
    });
    // 6. Send verification email via EmailService
    try {
        await email_1.EmailService.sendEmail({
            to: user.email,
            subject: 'Verify Your Email',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to Ferry Booking System</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Your email verification OTP code is:</p>
          <h1 style="color: #2563eb; letter-spacing: 4px;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `,
        });
    }
    catch (err) {
        // If sending fails, log and continue so user creation doesn't fail
        console.error('Failed to send verification email:', err);
    }
    return {
        userId: user.id,
        accountState: user_1.ACCOUNT_STATE.UNVERIFIED,
        status: user.status,
        message: 'Registration successful. Please check your email for the verification OTP.',
    };
};
const verifyEmail = async (payload) => {
    const email = payload.email.toLowerCase().trim();
    const otpCode = String(payload.otp ?? payload.oneTimeCode ?? '').trim();
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        include: { operatorProfile: true },
    });
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid email or OTP');
    }
    if (user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Account has been deleted');
    }
    if (user.status === client_1.AccountStatus.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended. Please contact support.');
    }
    if (user.status === client_1.AccountStatus.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }
    if (user.status !== client_1.AccountStatus.UNVERIFIED && user.isEmailVerified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email is already verified');
    }
    const tokenRecord = await prisma_1.prisma.verificationToken.findFirst({
        where: {
            userId: user.id,
            type: client_1.TokenType.EMAIL_VERIFICATION,
        },
        orderBy: { createdAt: 'desc' },
    });
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP has expired or is invalid');
    }
    const isValid = await bcrypt_1.default.compare(otpCode, tokenRecord.tokenHash);
    if (!isValid) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid email or OTP');
    }
    // Update user as verified and active
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            status: client_1.AccountStatus.ACTIVE,
            isEmailVerified: true,
        },
        include: {
            operatorProfile: true,
        },
    });
    // Delete used token
    await prisma_1.prisma.verificationToken.delete({
        where: { id: tokenRecord.id },
    });
    return {
        message: 'Email verified successfully. You can now log in.',
        data: {
            id: updatedUser.id,
            email: updatedUser.email,
            status: updatedUser.status,
            accountState: user_1.ACCOUNT_STATE.VERIFIED,
            isApproved: true,
        },
    };
};
const resendVerificationEmail = async (email) => {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: normalizedEmail },
    });
    // Generic response to prevent email enumeration
    if (!user || user.deletedAt) {
        return {
            message: 'If this email is registered, a new OTP has been sent.',
        };
    }
    if (user.status !== client_1.AccountStatus.UNVERIFIED && user.isEmailVerified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email is already verified');
    }
    if (user.status === client_1.AccountStatus.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended. Please contact support.');
    }
    if (user.status === client_1.AccountStatus.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }
    // Delete existing unused email tokens
    await prisma_1.prisma.verificationToken.deleteMany({
        where: {
            userId: user.id,
            type: client_1.TokenType.EMAIL_VERIFICATION,
        },
    });
    // Generate new OTP
    const otp = generateNumericOtp(6);
    const tokenHash = await bcrypt_1.default.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await prisma_1.prisma.verificationToken.create({
        data: {
            userId: user.id,
            tokenHash,
            type: client_1.TokenType.EMAIL_VERIFICATION,
            expiresAt,
        },
    });
    try {
        await email_1.EmailService.sendEmail({
            to: user.email,
            subject: 'Verify Your Email',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Verification OTP</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Your new verification OTP code is:</p>
          <h1 style="color: #2563eb; letter-spacing: 4px;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `,
        });
    }
    catch (err) {
        console.error('Failed to send resend email:', err);
    }
    return { message: 'If this email is registered, a new OTP has been sent.' };
};
const loginUser = async (payload, ipAddress, deviceInfo) => {
    const email = payload.email.toLowerCase().trim();
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        include: {
            operatorProfile: true,
        },
    });
    if (!user || !user.passwordHash) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid credentials');
    }
    if (user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Account has been deleted');
    }
    if (user.status === client_1.AccountStatus.UNVERIFIED && !user.isEmailVerified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Please verify your email to login');
    }
    if (user.status === client_1.AccountStatus.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended');
    }
    if (user.status === client_1.AccountStatus.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is deactivated');
    }
    // Check temporary or hard lockout
    const isLocked = user.status === client_1.AccountStatus.LOCKED;
    const isTempLocked = user.lockedUntil && user.lockedUntil > new Date();
    if (isTempLocked || (isLocked && !user.lockedUntil)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is locked. Please try again later.');
    }
    const isPasswordValid = await bcrypt_1.default.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        if (attempts >= 5) {
            await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    status: client_1.AccountStatus.LOCKED,
                    failedLoginAttempts: attempts,
                    lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
                },
            });
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Too many failed attempts. Your account has been locked for 15 minutes.');
        }
        else {
            await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: attempts,
                },
            });
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }
    }
    // Password is valid - reset failed attempts
    if (user.failedLoginAttempts > 0 || user.status === client_1.AccountStatus.LOCKED || user.lockedUntil) {
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                status: client_1.AccountStatus.ACTIVE,
            },
        });
    }
    // Create database session with refresh token
    const { session, plainRefreshToken } = await session_service_1.SessionService.createSession(user.id, deviceInfo, ipAddress);
    // Generate JWT access token
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: user.id,
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        accountState: user.status === client_1.AccountStatus.ACTIVE ? user_1.ACCOUNT_STATE.VERIFIED : user.status,
        sessionId: session.id,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in || '15m');
    return {
        tokens: {
            accessToken,
            refreshToken: plainRefreshToken,
        },
        sessionId: session.id,
        isApproved: true,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phoneNumber: user.phoneNumber,
            phone: user.phoneNumber,
            status: user.status,
            accountState: user.status === client_1.AccountStatus.ACTIVE ? user_1.ACCOUNT_STATE.VERIFIED : user.status,
            ...(user.operatorProfile ? { operatorProfile: user.operatorProfile } : {}),
        },
    };
};
const refreshToken = async (tokenOrSessionId, refreshTokenStr, ipAddress, deviceInfo) => {
    let sessionId = tokenOrSessionId;
    let token = refreshTokenStr || '';
    // If only one token is provided, determine if it's a JWT or direct refresh token
    if (!token && tokenOrSessionId) {
        try {
            const decoded = jwtHelper_1.jwtHelper.verifyToken(tokenOrSessionId, config_1.default.jwt.jwt_refresh_secret);
            if (decoded?.sessionId) {
                sessionId = decoded.sessionId;
            }
            token = tokenOrSessionId;
        }
        catch {
            token = tokenOrSessionId;
        }
    }
    if (!token) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Refresh token is required');
    }
    const { session, newPlainRefreshToken } = await session_service_1.SessionService.refreshSession(sessionId, token, ipAddress, deviceInfo);
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: session.userId },
        include: { operatorProfile: true },
    });
    if (!user || user.deletedAt || user.status !== client_1.AccountStatus.ACTIVE) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'User is no longer active');
    }
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: user.id,
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
        sessionId: session.id,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in || '15m');
    return {
        tokens: {
            accessToken,
            refreshToken: newPlainRefreshToken,
        },
        sessionId: session.id,
    };
};
const logoutUser = async (user, sessionId, _deviceToken) => {
    const currentSessionId = sessionId || user.sessionId;
    if (currentSessionId) {
        await session_service_1.SessionService.revokeSession(currentSessionId, session_service_1.RevocationReason.USER_LOGOUT);
    }
    return { message: 'User logged out successfully.' };
};
const logoutAll = async (userId) => {
    await session_service_1.SessionService.revokeAllUserSessions(userId, session_service_1.RevocationReason.USER_LOGOUT_ALL);
    return { message: 'Logged out from all devices' };
};
const forgotPassword = async (email) => {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: normalizedEmail },
    });
    if (!user || user.deletedAt) {
        return {
            message: 'If an account with this email exists, a password reset link has been sent.',
        };
    }
    // Delete existing unused password tokens
    await prisma_1.prisma.verificationToken.deleteMany({
        where: { userId: user.id, type: client_1.TokenType.PASSWORD_RESET },
    });
    const resetToken = generateSecureToken();
    const tokenHash = await bcrypt_1.default.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await prisma_1.prisma.verificationToken.create({
        data: {
            userId: user.id,
            tokenHash,
            type: client_1.TokenType.PASSWORD_RESET,
            expiresAt,
        },
    });
    try {
        await email_1.EmailService.sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested to reset your password. Use the following token to reset it:</p>
          <p style="background: #f3f4f6; padding: 10px; font-family: monospace;">${resetToken}</p>
          <p>This link/token will expire in 15 minutes.</p>
        </div>
      `,
        });
    }
    catch (err) {
        console.error('Failed to send reset password email:', err);
    }
    return {
        message: 'If an account with this email exists, a password reset link has been sent.',
    };
};
const resetPassword = async (rawToken, payload) => {
    const token = (payload.token || rawToken || '').replace(/^Bearer\s+/i, '').trim();
    const email = payload.email?.toLowerCase().trim();
    let user = email ? await prisma_1.prisma.user.findUnique({ where: { email } }) : null;
    let tokenRecord = null;
    if (user) {
        tokenRecord = await prisma_1.prisma.verificationToken.findFirst({
            where: {
                userId: user.id,
                type: client_1.TokenType.PASSWORD_RESET,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    else {
        // If email wasn't provided, search recent tokens
        const recentTokens = await prisma_1.prisma.verificationToken.findMany({
            where: {
                type: client_1.TokenType.PASSWORD_RESET,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        for (const t of recentTokens) {
            if (await bcrypt_1.default.compare(token, t.tokenHash)) {
                tokenRecord = t;
                user = await prisma_1.prisma.user.findUnique({ where: { id: t.userId } });
                break;
            }
        }
    }
    if (!user || !tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Token has expired or is invalid');
    }
    const isValid = await bcrypt_1.default.compare(token, tokenRecord.tokenHash);
    if (!isValid) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid email or token');
    }
    const newPasswordHash = await bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds) || 12);
    // Update password and clear lockout
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: newPasswordHash,
            lockedUntil: null,
            failedLoginAttempts: 0,
            status: client_1.AccountStatus.ACTIVE,
        },
    });
    // Delete used token
    await prisma_1.prisma.verificationToken.delete({
        where: { id: tokenRecord.id },
    });
    // Revoke all existing sessions
    await session_service_1.SessionService.revokeAllUserSessions(user.id, session_service_1.RevocationReason.PASSWORD_RESET);
    return {
        message: 'Password has been reset successfully. You can now log in.',
    };
};
const changePassword = async (user, payload) => {
    const currentPassword = payload.currentPassword || payload.oldPassword;
    if (!currentPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Current password is required');
    }
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { id: user.id },
    });
    if (!existingUser || !existingUser.passwordHash) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const isMatch = await bcrypt_1.default.compare(currentPassword, existingUser.passwordHash);
    if (!isMatch) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect old password');
    }
    if (currentPassword === payload.newPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'New password must be different from current password');
    }
    const hashPassword = await bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds) || 12);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword },
    });
    // Revoke all other sessions after a password change to ensure security
    await session_service_1.SessionService.revokeAllUserSessions(user.id, session_service_1.RevocationReason.PASSWORD_CHANGED);
    return {
        message: 'Password updated successfully. All devices have been logged out. Please log in again.',
    };
};
const claimAdmin = async (user, payload) => {
    const { email, currentPassword, newPassword } = payload;
    const isExistUser = await prisma_1.prisma.user.findUnique({
        where: { id: user.id },
    });
    if (!isExistUser || !isExistUser.passwordHash) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Admin account not found');
    }
    if (isExistUser.role !== client_1.Role.ADMIN && !isExistUser.isRootAdmin) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only admin accounts can perform initial setup');
    }
    const isMatch = await bcrypt_1.default.compare(currentPassword, isExistUser.passwordHash);
    if (!isMatch) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Current password is incorrect');
    }
    const hashPassword = await bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds) || 12);
    const updatedAdmin = await prisma_1.prisma.user.update({
        where: { id: isExistUser.id },
        data: {
            email,
            passwordHash: hashPassword,
            status: client_1.AccountStatus.ACTIVE,
        },
    });
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: updatedAdmin.id,
        sub: updatedAdmin.id,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        status: updatedAdmin.status,
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in || '1d');
    return {
        tokens: { accessToken, refreshToken: '' },
        user: {
            id: updatedAdmin.id,
            email: updatedAdmin.email,
        },
    };
};
const getMyStatus = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            operatorProfile: true,
        },
    });
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        accountState: user.status === client_1.AccountStatus.ACTIVE ? user_1.ACCOUNT_STATE.VERIFIED : user.status,
        isEmailVerified: user.isEmailVerified,
        phoneNumber: user.phoneNumber,
        phone: user.phoneNumber,
        companyName: user.operatorProfile?.companyName,
        contactPersonName: user.operatorProfile?.contactPersonName,
        operatorProfile: user.operatorProfile,
        isApproved: user.status === client_1.AccountStatus.ACTIVE || user.isEmailVerified,
    };
};
exports.AuthService = {
    registerUser,
    verifyEmail,
    resendVerificationEmail,
    loginUser,
    refreshToken,
    logoutUser,
    logoutAll,
    forgotPassword,
    resetPassword,
    changePassword,
    claimAdmin,
    getMyStatus,
};
//# sourceMappingURL=auth.service.js.map