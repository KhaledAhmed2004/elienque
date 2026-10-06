import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';

const router = express.Router();

// 2.1 Register New Chauffeur
router.post(
  '/register',
  rateLimitMiddleware({ windowMs: 3600000, max: 5, routeName: 'register-ip' }),
  rateLimitMiddleware({ windowMs: 3600000, max: 3, routeName: 'register-phone', keyResolver: (req) => req.body?.phone }),
  rateLimitMiddleware({ windowMs: 3600000, max: 3, routeName: 'register-email', keyResolver: (req) => req.body?.email }),
  validateRequest(AuthValidation.registerUserZodSchema),
  AuthController.registerUser,
);

// 2.2 Verify OTP
router.post(
  '/verify-otp',
  rateLimitMiddleware({ windowMs: 60_000, max: 5, routeName: 'verify-otp' }),
  validateRequest(AuthValidation.verifyOtpSchema),
  AuthController.verifyOtp,
);

// 2.3 Resend OTP
router.post(
  '/resend-otp',
  rateLimitMiddleware({ windowMs: 60_000, max: 3, routeName: 'resend-otp' }),
  validateRequest(AuthValidation.resendOtpSchema),
  AuthController.resendOtp,
);

// 2.4 Login
router.post(
  '/login',
  validateRequest(AuthValidation.loginSchema),
  AuthController.loginUser,
);

// 2.5 Refresh Token
router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshTokenSchema),
  AuthController.refreshToken,
);

// 2.6 Logout
router.post(
  '/logout',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  AuthController.logoutUser,
);

// 2.7 Get Current User Profile / Status
router.get(
  '/me',
  auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.ADMIN, { allowPending: true }),
  AuthController.getMyStatus,
);

// Additional password management routes
router.post(
  '/forget-password',
  validateRequest(AuthValidation.forgetPasswordSchema),
  AuthController.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword,
);

router.post(
  '/change-password',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  validateRequest(AuthValidation.changePasswordSchema),
  AuthController.changePassword,
);

router.post(
  '/claim-admin',
  auth(USER_ROLES.ADMIN),
  validateRequest(AuthValidation.claimAdminZodSchema),
  AuthController.claimAdmin,
);

export const AuthRoutes = router;
