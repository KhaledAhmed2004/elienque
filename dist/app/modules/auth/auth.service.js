"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const auth_constant_1 = require("./auth.constant");
const cryptoToken_1 = __importDefault(require("../../../util/cryptoToken"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const resetToken_model_1 = require("./resetToken/resetToken.model");
const user_model_1 = require("../user/user.model");
const emailOutbox_model_1 = require("../emailOutbox/emailOutbox.model");
const user_1 = require("../../../enums/user");
const cryptoHelpers_1 = require("../../../helpers/cryptoHelpers");
const auth_helper_1 = require("./auth.helper");
const registerUser = async (payload) => {
    const { email, phone } = payload;
    const existingUser = await user_model_1.User.findOne({
        $or: [{ email }, { phone }],
    });
    if (existingUser) {
        const isEmailRegistered = existingUser.email.toLowerCase() === email;
        if (isEmailRegistered) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email is already registered. Please login or verify your email.');
        }
        const isPhoneRegistered = existingUser.phone === phone;
        if (isPhoneRegistered) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Phone number is already registered.');
        }
    }
    const session = await mongoose_1.default.startSession();
    let registeredUserId;
    let registeredAccountState;
    try {
        await session.withTransaction(async () => {
            const otp = (0, generateOTP_1.default)();
            const otpHash = (0, cryptoHelpers_1.hashOtp)(String(otp));
            const registrationAuthSession = {
                hashedOtp: otpHash,
                expireAt: new Date(Date.now() + auth_constant_1.OTP_EXPIRY_MS),
                attempts: 0,
                resendTimestamps: [new Date()],
                purpose: 'REGISTRATION',
            };
            const [user] = await user_model_1.User.create([
                {
                    ...payload,
                    email,
                    phone,
                    role: payload.role,
                    accountState: user_1.ACCOUNT_STATE.UNVERIFIED,
                    authentication: registrationAuthSession,
                },
            ], { session });
            if (!user) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
            }
            registeredUserId = user._id;
            registeredAccountState = user.accountState;
            const emailPayload = {
                name: user.name,
                otp,
                email: user.email,
            };
            await emailOutbox_model_1.EmailOutbox.create([
                {
                    to: user.email,
                    type: 'VERIFY_EMAIL',
                    template: 'CREATE_ACCOUNT',
                    encryptedPayload: (0, cryptoHelpers_1.encryptPayload)(emailPayload),
                    status: 'PENDING',
                },
            ], { session });
        });
    }
    finally {
        await session.endSession();
    }
    return {
        userId: registeredUserId,
        accountState: registeredAccountState,
    };
};
const claimAdmin = async (user, payload) => {
    const { email, currentPassword, newPassword } = payload;
    const isExistUser = await user_model_1.User.findById(user.id).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Admin account not found');
    }
    if (isExistUser.role !== user_1.USER_ROLES.ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only admin accounts can perform initial setup');
    }
    const isMatch = await user_model_1.User.isMatchPassword(currentPassword, isExistUser.password);
    if (!isMatch) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Current password is incorrect');
    }
    if (currentPassword === newPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'New password must be different from current password');
    }
    if (email !== isExistUser.email.toLowerCase()) {
        const emailInUse = await user_model_1.User.findOne({ email, _id: { $ne: isExistUser._id } });
        if (emailInUse) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email address is already in use by another account');
        }
    }
    const hashPassword = await bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    const updatedAdmin = await user_model_1.User.findByIdAndUpdate(isExistUser._id, {
        email,
        password: hashPassword,
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
    }, { new: true });
    if (!updatedAdmin) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update admin credentials');
    }
    const { accessToken, refreshToken } = (0, auth_helper_1.generateUserTokens)(updatedAdmin);
    return {
        tokens: { accessToken, refreshToken },
        user: {
            id: updatedAdmin._id,
            email: updatedAdmin.email,
        },
    };
};
const handleRegistrationTokenGeneration = (user) => {
    const isApproved = true;
    const { accessToken, refreshToken } = (0, auth_helper_1.generateUserTokens)({
        _id: user._id,
        role: user.role,
        email: user.email,
        accountState: user_1.ACCOUNT_STATE.VERIFIED,
    });
    return {
        message: 'Email verified successfully.',
        tokens: { accessToken, refreshToken },
        data: {
            accessToken,
            refreshToken,
            accountState: user_1.ACCOUNT_STATE.VERIFIED,
            isApproved,
        },
    };
};
const handlePasswordResetTokenGeneration = async (userId) => {
    const createToken = (0, cryptoToken_1.default)();
    const hashedToken = crypto_1.default
        .createHash('sha256')
        .update(createToken)
        .digest('hex');
    await resetToken_model_1.ResetToken.create({
        user: userId,
        token: hashedToken,
        expireAt: new Date(Date.now() + auth_constant_1.RESET_TOKEN_EXPIRY_MS),
    });
    return {
        message: 'Verification Successful: Please securely store and utilize this code for reset password',
        data: createToken,
    };
};
const verifyOtp = async (payload) => {
    const { email, oneTimeCode } = payload;
    const isExistUser = await user_model_1.User.findOne({ email }).select('+authentication');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid email or verification code.');
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended. Please contact support.');
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }
    const auth = isExistUser.authentication;
    const storedOtpHash = auth?.hashedOtp;
    const storedPurpose = auth?.purpose;
    // Strict check: reject null / unknown purpose explicitly (no implicit fallback)
    if (!storedPurpose ||
        (storedPurpose !== 'REGISTRATION' && storedPurpose !== 'PASSWORD_RESET')) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or expired verification session. Please request a new code.');
    }
    const date = new Date();
    if (!auth?.expireAt || date > new Date(auth.expireAt)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This verification code has expired. Please request a new one.');
    }
    // Check code match using constant-time comparison
    if (!storedOtpHash || !(0, cryptoHelpers_1.verifyOtpHash)(String(oneTimeCode), storedOtpHash)) {
        const updatedUser = await user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, { $inc: { 'authentication.attempts': 1 } }, { new: true, select: '+authentication' });
        const newAttempts = updatedUser?.authentication?.attempts || 0;
        if (newAttempts >= auth_constant_1.OTP_MAX_ATTEMPTS) {
            await user_model_1.User.findByIdAndUpdate(isExistUser._id, {
                $set: {
                    'authentication.hashedOtp': null,
                    'authentication.expireAt': null,
                    'authentication.purpose': null,
                },
            });
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Maximum verification attempts exceeded. Please request a new code.');
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid email or verification code.');
    }
    // Atomic CAS Consumption:
    const consumedUser = await user_model_1.User.findOneAndUpdate({
        _id: isExistUser._id,
        'authentication.hashedOtp': storedOtpHash,
        'authentication.expireAt': { $gt: new Date() },
        'authentication.purpose': storedPurpose,
    }, {
        $set: {
            'authentication.hashedOtp': null,
            'authentication.expireAt': null,
            'authentication.attempts': 0,
            'authentication.purpose': null,
            ...(storedPurpose === 'REGISTRATION'
                ? {
                    accountState: user_1.ACCOUNT_STATE.VERIFIED,
                }
                : {
                    'authentication.isResetPassword': true,
                }),
        },
    }, { new: false, select: '+authentication' });
    if (!consumedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Verification code has already been used or expired.');
    }
    const consumedPurpose = consumedUser.authentication?.purpose || storedPurpose;
    if (consumedPurpose === 'REGISTRATION') {
        return handleRegistrationTokenGeneration(consumedUser);
    }
    else if (consumedPurpose === 'PASSWORD_RESET') {
        return handlePasswordResetTokenGeneration(consumedUser._id);
    }
    else {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid verification purpose.');
    }
};
const resendOtp = async (email) => {
    const user = await user_model_1.User.findOne({ email }).select('+authentication');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No account found with this email address.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.VERIFIED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Your email is already verified.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended. Please contact support.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }
    // Rate limit: prevent resend within 60 seconds
    const lastSent = user.authentication?.expireAt;
    if (lastSent) {
        const sentAtMs = new Date(lastSent).getTime() - auth_constant_1.OTP_EXPIRY_MS;
        const elapsedMs = Date.now() - sentAtMs;
        if (elapsedMs < auth_constant_1.OTP_COOLDOWN_MS) {
            const waitSeconds = Math.ceil((auth_constant_1.OTP_COOLDOWN_MS - elapsedMs) / 1000);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.TOO_MANY_REQUESTS, `Please wait ${waitSeconds} seconds before requesting a new code.`);
        }
    }
    const session = await mongoose_1.default.startSession();
    try {
        await session.withTransaction(async () => {
            const otp = (0, generateOTP_1.default)();
            const emailPayload = {
                name: user.name,
                otp,
                email: user.email,
            };
            await emailOutbox_model_1.EmailOutbox.create([
                {
                    to: user.email,
                    type: 'VERIFY_EMAIL',
                    template: 'CREATE_ACCOUNT',
                    encryptedPayload: (0, cryptoHelpers_1.encryptPayload)(emailPayload),
                    status: 'PENDING',
                },
            ], { session });
            const currentPurpose = user.authentication?.purpose || 'REGISTRATION';
            await user_model_1.User.findOneAndUpdate({ _id: user._id }, {
                $set: {
                    'authentication.hashedOtp': (0, cryptoHelpers_1.hashOtp)(String(otp)),
                    'authentication.expireAt': new Date(Date.now() + auth_constant_1.OTP_EXPIRY_MS),
                    'authentication.attempts': 0,
                    'authentication.purpose': currentPurpose,
                },
                $push: {
                    'authentication.resendTimestamps': new Date(),
                },
            }, { session });
        });
    }
    finally {
        await session.endSession();
    }
    return { message: 'A new verification code has been sent to your email.' };
};
const forgetPassword = async (email) => {
    const isExistUser = await user_model_1.User.isExistUserByEmail(email);
    if (!isExistUser) {
        return {
            message: 'If your email is registered, a one-time passcode (OTP) has been sent.',
        };
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been suspended. Please contact support.');
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }
    const session = await mongoose_1.default.startSession();
    try {
        await session.withTransaction(async () => {
            const otp = (0, generateOTP_1.default)();
            const emailPayload = {
                name: isExistUser.name,
                otp,
                email: isExistUser.email,
            };
            await emailOutbox_model_1.EmailOutbox.create([
                {
                    to: isExistUser.email,
                    type: 'RESET_PASSWORD',
                    template: 'RESET_PASSWORD',
                    encryptedPayload: (0, cryptoHelpers_1.encryptPayload)(emailPayload),
                    status: 'PENDING',
                },
            ], { session });
            const authentication = {
                hashedOtp: (0, cryptoHelpers_1.hashOtp)(String(otp)),
                expireAt: new Date(Date.now() + auth_constant_1.OTP_EXPIRY_MS),
                attempts: 0,
                resendTimestamps: [new Date()],
                purpose: 'PASSWORD_RESET',
            };
            await user_model_1.User.findOneAndUpdate({ email: isExistUser.email }, { $set: { authentication } }, { session });
        });
    }
    finally {
        await session.endSession();
    }
    return {
        message: 'Please check your email. We have sent you a one-time passcode (OTP).',
    };
};
const resetPassword = async (token, payload) => {
    const cleanToken = token ? token.replace(/^Bearer\s+/i, '').trim() : '';
    const { newPassword } = payload;
    const hashedToken = crypto_1.default
        .createHash('sha256')
        .update(cleanToken)
        .digest('hex');
    // Atomic single-use consumption: find and delete in a single operation
    const consumedToken = await resetToken_model_1.ResetToken.findOneAndDelete({
        token: hashedToken,
        expireAt: { $gt: new Date() },
    });
    if (!consumedToken) {
        const expiredToken = await resetToken_model_1.ResetToken.findOne({ token: hashedToken });
        if (expiredToken) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Token expired, Please click again to the forget password');
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }
    const hashPassword = await bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    await user_model_1.User.findOneAndUpdate({ _id: consumedToken.user }, {
        password: hashPassword,
        $set: { 'authentication.isResetPassword': false },
    });
};
const changePassword = async (user, payload) => {
    const { currentPassword, newPassword } = payload;
    const isExistUser = await user_model_1.User.findById(user.id).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No account found with this email address.');
    }
    const isMatch = await user_model_1.User.isMatchPassword(currentPassword, isExistUser.password);
    if (!isMatch) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password is incorrect');
    }
    if (currentPassword === newPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please give different password from current password');
    }
    const hashPassword = await bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    await user_model_1.User.findOneAndUpdate({ _id: user.id }, { password: hashPassword }, { new: true });
};
const loginUser = async (payload) => {
    const { email, password, deviceToken } = payload;
    const isExistUser = await user_model_1.User.findOne({ email }).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect email or password. Please try again.');
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.UNVERIFIED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please verify your email first. We sent a verification code to your email address.');
    }
    if (isExistUser.accountState === user_1.ACCOUNT_STATE.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Your account has been deactivated. Contact support.');
    }
    if (isExistUser.lockUntil && new Date() < new Date(isExistUser.lockUntil)) {
        const remainingMinutes = Math.max(1, Math.ceil((new Date(isExistUser.lockUntil).getTime() - Date.now()) / (60 * 1000)));
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Account is temporarily locked due to failed login attempts. Please try again in ${remainingMinutes} minutes.`);
    }
    const isMatch = await user_model_1.User.isMatchPassword(password, isExistUser.password);
    if (!isMatch) {
        const updatedUser = await user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, { $inc: { loginAttempts: 1 } }, { new: true });
        const attempts = updatedUser?.loginAttempts || 1;
        const { lockUntil, isLocked } = (0, auth_constant_1.calculateLockoutState)(attempts);
        if (isLocked && lockUntil) {
            await user_model_1.User.findOneAndUpdate({
                _id: isExistUser._id,
                $or: [
                    { lockUntil: { $exists: false } },
                    { lockUntil: null },
                    { lockUntil: { $lt: lockUntil } },
                ],
            }, {
                $set: {
                    lockUntil,
                    accountState: user_1.ACCOUNT_STATE.LOCKED,
                },
            });
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect email or password. Please try again.');
    }
    await user_model_1.User.findByIdAndUpdate(isExistUser._id, {
        $set: {
            loginAttempts: 0,
            lockUntil: null,
            accountState: isExistUser.accountState === user_1.ACCOUNT_STATE.LOCKED
                ? user_1.ACCOUNT_STATE.VERIFIED
                : isExistUser.accountState,
        },
    });
    const { accessToken, refreshToken } = (0, auth_helper_1.generateUserTokens)(isExistUser);
    if (deviceToken) {
        await user_model_1.User.addDeviceToken(isExistUser._id.toString(), deviceToken);
    }
    const { isApproved, isOnboard } = (0, auth_helper_1.computeUserAccessState)(isExistUser);
    const isSuspended = isExistUser.accountState === user_1.ACCOUNT_STATE.SUSPENDED;
    const responseData = {
        accessToken,
        accountState: isExistUser.accountState,
        ...(isExistUser.rejectionReason && {
            rejectionReason: isExistUser.rejectionReason,
        }),
        ...(isSuspended && {
            isRestricted: true,
            blockReason: isExistUser.blockReason ?? null,
        }),
    };
    return {
        tokens: { accessToken, refreshToken },
        data: responseData,
        isOnboard: true,
        isApproved: true,
        ...(isSuspended && {
            isRestricted: true,
            blockReason: isExistUser.blockReason ?? null,
        }),
        rejectionReason: isExistUser.rejectionReason ?? null,
    };
};
const logoutUser = async (user, deviceToken) => {
    if (deviceToken) {
        await user_model_1.User.removeDeviceToken(user.id, deviceToken);
    }
};
const refreshToken = async (token) => {
    if (!token) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Refresh token is required');
    }
    const decoded = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_refresh_secret);
    const userId = decoded.id;
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'No account found with this email address.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.UNVERIFIED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please verify your email first.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.SUSPENDED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Your account has been restricted. Contact support.');
    }
    if (user.accountState === user_1.ACCOUNT_STATE.DEACTIVATED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Your account has been deactivated. Contact support.');
    }
    if (user.lockUntil && new Date() < new Date(user.lockUntil)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Account is temporarily locked due to failed login attempts.');
    }
    const { accessToken, refreshToken: newRefreshToken } = (0, auth_helper_1.generateUserTokens)(user);
    return { tokens: { accessToken, refreshToken: newRefreshToken } };
};
const getMyStatus = async (userId) => {
    const user = await user_model_1.User.findById(userId)
        .select('name email role appState accountState isOnboard rejectionReason blockReason serviceAreaId')
        .lean();
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const { isApproved } = (0, auth_helper_1.computeUserAccessState)(user);
    return {
        name: user.name,
        email: user.email,
        role: user.role,
        accountState: user.accountState,
        isApproved,
        rejectionReason: user.rejectionReason ?? null,
        blockReason: user.blockReason ?? null,
    };
};
exports.AuthService = {
    registerUser,
    claimAdmin,
    verifyOtp,
    resendOtp,
    forgetPassword,
    resetPassword,
    changePassword,
    loginUser,
    logoutUser,
    refreshToken,
    getMyStatus,
};
//# sourceMappingURL=auth.service.js.map