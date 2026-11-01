"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const rateLimit_1 = require("../../middlewares/rateLimit");
const auth_controller_1 = require("./auth.controller");
const auth_validation_1 = require("./auth.validation");
const router = express_1.default.Router();
// Register a new user or operator account
router.post('/register', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 5, routeName: 'register-ip' }), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 3600000,
    max: 3,
    routeName: 'register-phone',
    keyResolver: req => req.body?.phoneNumber || req.body?.phone,
}), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 3600000,
    max: 3,
    routeName: 'register-email',
    keyResolver: req => req.body?.email,
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.registerUserZodSchema), auth_controller_1.AuthController.registerUser);
// Verify email address using 6-digit OTP
router.post('/verify-email', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 5, routeName: 'verify-email' }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.verifyOtpSchema), auth_controller_1.AuthController.verifyEmail);
// Resend verification OTP to user's email
router.post('/verify-email/resend', (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 3,
    routeName: 'resend-verification',
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resendOtpSchema), auth_controller_1.AuthController.resendVerification);
// User and operator authentication (login)
router.post('/login', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 5, routeName: 'login' }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.loginSchema), auth_controller_1.AuthController.loginUser);
// Refresh access token via rotational session token
router.post('/refresh', (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 30,
    routeName: 'refresh-token',
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.refreshTokenSchema), auth_controller_1.AuthController.refreshToken);
// Logout from current active session
router.post('/logout', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.OPERATOR, user_1.USER_ROLES.ADMIN), auth_controller_1.AuthController.logoutUser);
// Logout and revoke all active sessions across all devices
router.post('/logout-all', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.OPERATOR, user_1.USER_ROLES.ADMIN), auth_controller_1.AuthController.logoutAll);
// Request password reset token via email
router.post('/forgot-password', (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 3,
    routeName: 'forgot-password',
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.forgetPasswordSchema), auth_controller_1.AuthController.forgotPassword);
// Reset password using valid verification token
router.post('/reset-password', (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 5,
    routeName: 'reset-password',
}), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resetPasswordSchema), auth_controller_1.AuthController.resetPassword);
// Claim and initialize root admin credentials (first-time onboarding)
router.post('/claim-admin', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 5, routeName: 'claim-admin' }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.claimAdminZodSchema), auth_controller_1.AuthController.claimAdmin);
exports.AuthRoutes = router;
//# sourceMappingURL=auth.route.js.map