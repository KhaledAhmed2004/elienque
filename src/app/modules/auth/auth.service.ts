import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload, Secret } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { jwtHelper } from '../../../helpers/jwtHelper';
import {
  calculateLockoutState,
  OTP_COOLDOWN_MS,
  OTP_EXPIRY_MS,
  OTP_MAX_ATTEMPTS,
  RESET_TOKEN_EXPIRY_MS,
} from './auth.constant';
import {
  IChangePasswordReq,
  IClaimAdminReq,
  ILoginReq,
  IRegisterUserReq,
  IResetPasswordReq,
  IVerifyOtpReq,
} from './auth.validation';
import { JwtUser } from '../../../types';
import cryptoToken from '../../../util/cryptoToken';
import generateOTP from '../../../util/generateOTP';
import { ResetToken } from './resetToken/resetToken.model';
import { User } from '../user/user.model';
import { IUser } from '../user/user.interface';
import { ServiceArea } from '../service-area/service-area.model';
import { EmailOutbox } from '../emailOutbox/emailOutbox.model';
import { ACCOUNT_STATE, APP_STATE, USER_ROLES } from '../../../enums/user';
import {
  hashOtp,
  verifyOtpHash,
  encryptPayload,
} from '../../../helpers/cryptoHelpers';
import {
  computeUserAccessState,
  generateUserTokens,
} from './auth.helper';

const registerUser = async (payload: IRegisterUserReq) => {
  const { email, phone } = payload;

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingUser) {
    const isEmailRegistered = existingUser.email.toLowerCase() === email;
    if (isEmailRegistered) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Email is already registered. Please login or verify your email.',
      );
    }

    const isPhoneRegistered = existingUser.phone === phone;
    if (isPhoneRegistered) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Phone number is already registered.',
      );
    }
  }

  if (payload.serviceAreaId) {
    const serviceArea = await ServiceArea.findById(payload.serviceAreaId);
    const isInvalidServiceArea = !serviceArea || serviceArea.status !== 'ACTIVE';
    if (isInvalidServiceArea) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or inactive service area');
    }
  }

  const session = await mongoose.startSession();

  let registeredUserId: mongoose.Types.ObjectId | undefined;
  let registeredAccountState: ACCOUNT_STATE | undefined;

  try {
    await session.withTransaction(async () => {
      const otp = generateOTP();
      const otpHash = hashOtp(String(otp));

      const registrationAuthSession = {
        hashedOtp: otpHash,
        expireAt: new Date(Date.now() + OTP_EXPIRY_MS),
        attempts: 0,
        resendTimestamps: [new Date()],
        purpose: 'REGISTRATION' as const,
      };

      const initialAppState =
        payload.role === USER_ROLES.PROMOTER ||
        payload.role === USER_ROLES.BUSINESS_OWNER
          ? APP_STATE.ACTIVE
          : APP_STATE.PENDING;

      const [user] = await User.create(
        [
          {
            ...payload,
            email,
            phone,
            role: payload.role,
            appState: initialAppState,
            accountState: ACCOUNT_STATE.UNVERIFIED,
            isOnboard: true,
            authentication: registrationAuthSession,
          },
        ],
        { session },
      );

      if (!user) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user');
      }

      registeredUserId = user._id;
      registeredAccountState = user.accountState;

      const emailPayload = {
        name: user.name,
        otp,
        email: user.email!,
      };

      await EmailOutbox.create(
        [
          {
            to: user.email,
            type: 'VERIFY_EMAIL',
            template: 'CREATE_ACCOUNT',
            encryptedPayload: encryptPayload(emailPayload),
            status: 'PENDING',
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    userId: registeredUserId,
    accountState: registeredAccountState,
  };
};

const claimAdmin = async (user: JwtUser, payload: IClaimAdminReq) => {
  const { email, currentPassword, newPassword } = payload;
  const isExistUser = await User.findById(user.id).select('+password');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Admin account not found');
  }

  if (isExistUser.role !== USER_ROLES.ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only admin accounts can perform initial setup');
  }

  const isMatch = await User.isMatchPassword(currentPassword, isExistUser.password!);
  if (!isMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'New password must be different from current password');
  }

  if (email !== isExistUser.email.toLowerCase()) {
    const emailInUse = await User.findOne({ email, _id: { $ne: isExistUser._id } });
    if (emailInUse) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email address is already in use by another account');
    }
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const updatedAdmin = await User.findByIdAndUpdate(
    isExistUser._id,
    {
      email,
      password: hashPassword,
      mustChangePassword: false,
      accountState: ACCOUNT_STATE.VERIFIED,
      appState: APP_STATE.ACTIVE,
    },
    { new: true },
  );

  if (!updatedAdmin) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update admin credentials');
  }

  const { accessToken, refreshToken } = generateUserTokens(updatedAdmin);

  return {
    tokens: { accessToken, refreshToken },
    user: {
      id: updatedAdmin._id,
      email: updatedAdmin.email,
      mustChangePassword: false,
    },
  };
};

const handleRegistrationTokenGeneration = (
  user: IUser & { _id: mongoose.Types.ObjectId },
) => {
  const isApproved =
    user.role === USER_ROLES.PROMOTER ||
    user.role === USER_ROLES.BUSINESS_OWNER ||
    user.appState === APP_STATE.ACTIVE;

  const currentAppState = isApproved ? APP_STATE.ACTIVE : APP_STATE.PENDING;

  const { accessToken, refreshToken } = generateUserTokens({
    _id: user._id,
    role: user.role,
    email: user.email,
    appState: currentAppState,
    accountState: ACCOUNT_STATE.VERIFIED,
    serviceAreaId: user.serviceAreaId,
    serviceArea: user.serviceArea,
  });

  return {
    message: isApproved
      ? 'Email verified successfully.'
      : 'Email verified successfully. Please wait for admin approval to access the app.',
    tokens: { accessToken, refreshToken },
    data: {
      accessToken,
      refreshToken,
      accountState: ACCOUNT_STATE.VERIFIED,
      appState: currentAppState,
      isApproved,
    },
  };
};

const handlePasswordResetTokenGeneration = async (
  userId: mongoose.Types.ObjectId,
) => {
  const createToken = cryptoToken();
  const hashedToken = crypto
    .createHash('sha256')
    .update(createToken)
    .digest('hex');

  await ResetToken.create({
    user: userId,
    token: hashedToken,
    expireAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
  });

  return {
    message:
      'Verification Successful: Please securely store and utilize this code for reset password',
    data: createToken,
  };
};

const verifyOtp = async (payload: IVerifyOtpReq) => {
  const { email, oneTimeCode } = payload;
  const isExistUser = await User.findOne({ email }).select('+authentication');

  if (!isExistUser) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid email or verification code.',
    );
  }

  if (isExistUser.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been suspended. Please contact support.',
    );
  }

  if (isExistUser.accountState === ACCOUNT_STATE.DEACTIVATED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been deactivated. Please contact support.',
    );
  }

  const auth = isExistUser.authentication;
  const storedOtpHash = auth?.hashedOtp;
  const storedPurpose = auth?.purpose;

  // Strict check: reject null / unknown purpose explicitly (no implicit fallback)
  if (
    !storedPurpose ||
    (storedPurpose !== 'REGISTRATION' && storedPurpose !== 'PASSWORD_RESET')
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid or expired verification session. Please request a new code.',
    );
  }

  const date = new Date();
  if (!auth?.expireAt || date > new Date(auth.expireAt)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This verification code has expired. Please request a new one.',
    );
  }

  // Check code match using constant-time comparison
  if (!storedOtpHash || !verifyOtpHash(String(oneTimeCode), storedOtpHash)) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: isExistUser._id },
      { $inc: { 'authentication.attempts': 1 } },
      { new: true, select: '+authentication' },
    );

    const newAttempts = updatedUser?.authentication?.attempts || 0;

    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      await User.findByIdAndUpdate(isExistUser._id, {
        $set: {
          'authentication.hashedOtp': null,
          'authentication.expireAt': null,
          'authentication.purpose': null,
        },
      });
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Maximum verification attempts exceeded. Please request a new code.',
      );
    }

    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid email or verification code.',
    );
  }

  // Atomic CAS Consumption:
  const consumedUser = await User.findOneAndUpdate(
    {
      _id: isExistUser._id,
      'authentication.hashedOtp': storedOtpHash,
      'authentication.expireAt': { $gt: new Date() },
      'authentication.purpose': storedPurpose,
    },
    {
      $set: {
        'authentication.hashedOtp': null,
        'authentication.expireAt': null,
        'authentication.attempts': 0,
        'authentication.purpose': null,
        ...(storedPurpose === 'REGISTRATION'
          ? {
              accountState: ACCOUNT_STATE.VERIFIED,
              isOnboard: true,
              appState:
                isExistUser.role === USER_ROLES.PROMOTER ||
                isExistUser.role === USER_ROLES.BUSINESS_OWNER
                  ? APP_STATE.ACTIVE
                  : APP_STATE.PENDING,
            }
          : {
              'authentication.isResetPassword': true,
            }),
      },
    },
    { new: false, select: '+authentication' },
  );

  if (!consumedUser) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Verification code has already been used or expired.',
    );
  }

  const consumedPurpose = consumedUser.authentication?.purpose || storedPurpose;
  if (consumedPurpose === 'REGISTRATION') {
    return handleRegistrationTokenGeneration(consumedUser);
  } else if (consumedPurpose === 'PASSWORD_RESET') {
    return handlePasswordResetTokenGeneration(consumedUser._id);
  } else {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid verification purpose.',
    );
  }
};

const resendOtp = async (email: string) => {
  const user = await User.findOne({ email }).select('+authentication');
  if (!user) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No account found with this email address.',
    );
  }
  if (user.accountState === ACCOUNT_STATE.VERIFIED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Your email is already verified.',
    );
  }
  if (user.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been suspended. Please contact support.',
    );
  }
  if (user.accountState === ACCOUNT_STATE.DEACTIVATED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been deactivated. Please contact support.',
    );
  }

  // Rate limit: prevent resend within 60 seconds
  const lastSent = user.authentication?.expireAt;
  if (lastSent) {
    const sentAtMs = new Date(lastSent).getTime() - OTP_EXPIRY_MS;
    const elapsedMs = Date.now() - sentAtMs;
    if (elapsedMs < OTP_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000);
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
      );
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const otp = generateOTP();
      
      const emailPayload = {
        name: user.name,
        otp,
        email: user.email!,
      };

      await EmailOutbox.create(
        [
          {
            to: user.email,
            type: 'VERIFY_EMAIL',
            template: 'CREATE_ACCOUNT',
            encryptedPayload: encryptPayload(emailPayload),
            status: 'PENDING',
          },
        ],
        { session },
      );

      const currentPurpose = user.authentication?.purpose || 'REGISTRATION';

      await User.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            'authentication.hashedOtp': hashOtp(String(otp)),
            'authentication.expireAt': new Date(Date.now() + OTP_EXPIRY_MS),
            'authentication.attempts': 0,
            'authentication.purpose': currentPurpose,
          },
          $push: {
            'authentication.resendTimestamps': new Date(),
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return { message: 'A new verification code has been sent to your email.' };
};

const forgetPassword = async (email: string) => {
  const isExistUser = await User.isExistUserByEmail(email);
  if (!isExistUser) {
    return {
      message:
        'If your email is registered, a one-time passcode (OTP) has been sent.',
    };
  }

  if (isExistUser.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been suspended. Please contact support.',
    );
  }

  if (isExistUser.accountState === ACCOUNT_STATE.DEACTIVATED) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your account has been deactivated. Please contact support.',
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const otp = generateOTP();

      const emailPayload = {
        name: isExistUser.name,
        otp,
        email: isExistUser.email,
      };

      await EmailOutbox.create(
        [
          {
            to: isExistUser.email,
            type: 'RESET_PASSWORD',
            template: 'RESET_PASSWORD',
            encryptedPayload: encryptPayload(emailPayload),
            status: 'PENDING',
          },
        ],
        { session },
      );

      const authentication = {
        hashedOtp: hashOtp(String(otp)),
        expireAt: new Date(Date.now() + OTP_EXPIRY_MS),
        attempts: 0,
        resendTimestamps: [new Date()],
        purpose: 'PASSWORD_RESET' as const,
      };

      await User.findOneAndUpdate(
        { email: isExistUser.email },
        { $set: { authentication } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    message: 'Please check your email. We have sent you a one-time passcode (OTP).',
  };
};

const resetPassword = async (token: string, payload: IResetPasswordReq) => {
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '').trim() : '';
  const { newPassword } = payload;

  const hashedToken = crypto
    .createHash('sha256')
    .update(cleanToken)
    .digest('hex');

  // Atomic single-use consumption: find and delete in a single operation
  const consumedToken = await ResetToken.findOneAndDelete({
    token: hashedToken,
    expireAt: { $gt: new Date() },
  });

  if (!consumedToken) {
    const expiredToken = await ResetToken.findOne({ token: hashedToken });
    if (expiredToken) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Token expired, Please click again to the forget password',
      );
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    { _id: consumedToken.user },
    {
      password: hashPassword,
      mustChangePassword: false,
      $set: { 'authentication.isResetPassword': false },
    },
  );
};

const changePassword = async (user: JwtPayload, payload: IChangePasswordReq) => {
  const { currentPassword, newPassword } = payload;
  const isExistUser = await User.findById(user.id).select('+password');
  if (!isExistUser) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No account found with this email address.',
    );
  }

  const isMatch = await User.isMatchPassword(currentPassword, isExistUser.password!);
  if (!isMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please give different password from current password',
    );
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    { _id: user.id },
    { password: hashPassword, mustChangePassword: false },
    { new: true },
  );
};

const loginUser = async (payload: ILoginReq & { deviceToken?: string }) => {
  const { email, password, deviceToken } = payload;
  const isExistUser = await User.findOne({ email }).select('+password');
  if (!isExistUser) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Incorrect email or password. Please try again.',
    );
  }

  if (isExistUser.accountState === ACCOUNT_STATE.UNVERIFIED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please verify your email first. We sent a verification code to your email address.',
    );
  }

  if (isExistUser.accountState === ACCOUNT_STATE.DEACTIVATED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Your account has been deactivated. Contact support.',
    );
  }

  if (isExistUser.lockUntil && new Date() < new Date(isExistUser.lockUntil)) {
    const remainingMinutes = Math.max(
      1,
      Math.ceil(
        (new Date(isExistUser.lockUntil).getTime() - Date.now()) / (60 * 1000),
      ),
    );
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Account is temporarily locked due to failed login attempts. Please try again in ${remainingMinutes} minutes.`,
    );
  }

  const isMatch = await User.isMatchPassword(password, isExistUser.password!);
  if (!isMatch) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: isExistUser._id },
      { $inc: { loginAttempts: 1 } },
      { new: true },
    );

    const attempts = updatedUser?.loginAttempts || 1;
    const { lockUntil, isLocked } = calculateLockoutState(attempts);

    if (isLocked && lockUntil) {
      await User.findOneAndUpdate(
        {
          _id: isExistUser._id,
          $or: [
            { lockUntil: { $exists: false } },
            { lockUntil: null },
            { lockUntil: { $lt: lockUntil } },
          ],
        },
        {
          $set: {
            lockUntil,
            accountState: ACCOUNT_STATE.LOCKED,
          },
        },
      );
    }

    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Incorrect email or password. Please try again.',
    );
  }

  await User.findByIdAndUpdate(isExistUser._id, {
    $set: {
      loginAttempts: 0,
      lockUntil: null,
      accountState:
        isExistUser.accountState === ACCOUNT_STATE.LOCKED
          ? ACCOUNT_STATE.VERIFIED
          : isExistUser.accountState,
    },
  });

  const { accessToken, refreshToken } = generateUserTokens(isExistUser);

  if (deviceToken) {
    await User.addDeviceToken(isExistUser._id.toString(), deviceToken);
  }

  const { isApproved, isOnboard } = computeUserAccessState(isExistUser);

  const isSuspended = isExistUser.accountState === ACCOUNT_STATE.SUSPENDED;

  const responseData: Record<string, any> = {
    accessToken,
    accountState: isExistUser.accountState,
    appState: isExistUser.appState,
    ...(isExistUser.rejectionReason && {
      rejectionReason: isExistUser.rejectionReason,
    }),
    ...(isSuspended && {
      isRestricted: true as const,
      blockReason: isExistUser.blockReason ?? null,
    }),
  };

  // mustChangePassword is only relevant for ADMIN accounts or users provisioned by admin with a temporary one-time password
  if (isExistUser.role === USER_ROLES.ADMIN || isExistUser.mustChangePassword) {
    responseData.mustChangePassword = Boolean(isExistUser.mustChangePassword);
  }

  return {
    tokens: { accessToken, refreshToken },
    data: responseData,
    isOnboard,
    isApproved,
    appState: isExistUser.appState,
    mustChangePassword: Boolean(isExistUser.mustChangePassword),
    ...(isSuspended && {
      isRestricted: true as const,
      blockReason: isExistUser.blockReason ?? null,
    }),
    rejectionReason: isExistUser.rejectionReason ?? null,
  };
};

const logoutUser = async (user: JwtPayload, deviceToken?: string) => {
  if (deviceToken) {
    await User.removeDeviceToken(user.id, deviceToken);
  }
};

const refreshToken = async (token: string) => {
  if (!token) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Refresh token is required');
  }

  const decoded = jwtHelper.verifyToken(
    token,
    config.jwt.jwt_refresh_secret as Secret,
  );

  const userId = decoded.id as string;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'No account found with this email address.',
    );
  }

  if (user.accountState === ACCOUNT_STATE.UNVERIFIED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please verify your email first.',
    );
  }

  if (user.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Your account has been restricted. Contact support.',
    );
  }

  if (user.accountState === ACCOUNT_STATE.DEACTIVATED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Your account has been deactivated. Contact support.',
    );
  }

  if (user.lockUntil && new Date() < new Date(user.lockUntil)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Account is temporarily locked due to failed login attempts.',
    );
  }

  const { accessToken, refreshToken: newRefreshToken } = generateUserTokens(user);

  return { tokens: { accessToken, refreshToken: newRefreshToken } };
};

const getMyStatus = async (userId: string) => {
  const user = await User.findById(userId)
    .select(
      'name email role appState accountState isOnboard rejectionReason blockReason serviceAreaId',
    )
    .lean();
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }
  const { isApproved, isOnboard } = computeUserAccessState(user);
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    appState: user.appState,
    accountState: user.accountState,
    isOnboard,
    isActive: user.appState === APP_STATE.ACTIVE,
    isApproved,
    rejectionReason: user.rejectionReason ?? null,
    blockReason: user.blockReason ?? null,
    serviceAreaId: user.serviceAreaId,
  };
};

export const AuthService = {
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
