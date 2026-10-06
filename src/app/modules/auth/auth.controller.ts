import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../../config';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AuthService } from './auth.service';
import { IAuthUser } from './auth.interface';
import {
  IChangePasswordReq,
  IRegisterUserReq,
  ILoginReq,
  IResetPasswordReq,
  IVerifyOtpReq,
  IClaimAdminReq,
} from './auth.validation';

// 2.1 Register User
const registerUser = catchAsync(async (req: Request, res: Response) => {
  const userData = req.body as IRegisterUserReq;
  const result = await AuthService.registerUser(userData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message:
      'Registration successful. Please check your email to verify your account.',
    data: result,
  });
});

// 2.2 Verify OTP
const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const verifyData = req.body as IVerifyOtpReq;
  const result = await AuthService.verifyOtp(verifyData);

  let responseData: any = result.data;

  // Set refresh token in httpOnly cookie for better security if tokens exist
  if (typeof result.data !== 'string' && result.tokens) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    responseData = {
      accessToken: result.tokens.accessToken,
      isApproved: result.data.isApproved ?? false,
    };
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: responseData,
  });
});

// 2.3 Resend OTP
const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resendOtp(req.body.email);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: null,
  });
});

// 2.4 Login
const loginUser = catchAsync(async (req: Request, res: Response) => {
  const loginData = req.body as ILoginReq;
  const result = await AuthService.loginUser(loginData);

  // Set refresh token in httpOnly cookie for better security
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged in successfully.',
    data: {
      accessToken: result.tokens.accessToken,
      isApproved: result.isApproved,
      ...(result.rejectionReason ? { rejectionReason: result.rejectionReason } : {}),
      ...(result.isRestricted
        ? { isRestricted: true, blockReason: result.blockReason }
        : {}),
    },
  });
});

// 2.5 Refresh Token
const refreshToken = catchAsync(async (req: Request, res: Response) => {
  // Prefer reading refresh token from cookie; fallback to body if present
  const cookieToken = req.cookies?.refreshToken as string | undefined;
  const bodyToken = (req.body as { refreshToken?: string })?.refreshToken;
  const token = cookieToken || bodyToken || '';

  const result = await AuthService.refreshToken(token);

  // Rotate refresh token in httpOnly cookie
  if (result?.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: config.node_env === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Token refreshed successfully.',
    data: result.tokens,
  });
});

// 2.6 Logout
const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const { deviceToken } = req.body;
  const user = req.user as IAuthUser;

  await AuthService.logoutUser(user, deviceToken);

  // Clear refresh token cookie on logout
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged out successfully.',
  });
});

// 2.7 Get Current User Profile / Status
const getMyStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IAuthUser;
  const result = await AuthService.getMyStatus(user.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Account status retrieved.',
    data: result,
  });
});

// Additional Password Management
const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const email = req.body.email;
  const result = await AuthService.forgetPassword(email);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const rawToken = req.headers.authorization || '';
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();
  const resetData = req.body as IResetPasswordReq;
  const result = await AuthService.resetPassword(token, resetData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully reset.',
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IAuthUser;
  const passwordData = req.body as IChangePasswordReq;
  await AuthService.changePassword(user, passwordData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully changed',
  });
});

const claimAdmin = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IAuthUser;
  const claimData = req.body as IClaimAdminReq;
  const result = await AuthService.claimAdmin(user, claimData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin account credentials updated successfully.',
    data: result,
  });
});

export const AuthController = {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  refreshToken,
  logoutUser,
  getMyStatus,
  forgetPassword,
  resetPassword,
  changePassword,
  claimAdmin,
};
