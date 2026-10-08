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
// 2.1 Register New Chauffeur
router.post('/register', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 5, routeName: 'register-ip' }), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 3, routeName: 'register-phone', keyResolver: (req) => req.body?.phone }), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 3, routeName: 'register-email', keyResolver: (req) => req.body?.email }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.registerUserZodSchema), auth_controller_1.AuthController.registerUser);
// 2.2 Verify OTP
router.post('/verify-otp', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 5, routeName: 'verify-otp' }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.verifyOtpSchema), auth_controller_1.AuthController.verifyOtp);
// 2.3 Resend OTP
router.post('/resend-otp', (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 3, routeName: 'resend-otp' }), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resendOtpSchema), auth_controller_1.AuthController.resendOtp);
// 2.4 Login
router.post('/login', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.loginSchema), auth_controller_1.AuthController.loginUser);
// 2.5 Refresh Token
router.post('/refresh-token', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.refreshTokenSchema), auth_controller_1.AuthController.refreshToken);
// 2.6 Logout
router.post('/logout', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), auth_controller_1.AuthController.logoutUser);
// 2.7 Get Current User Profile / Status
router.get('/me', (0, auth_1.default)(user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, user_1.USER_ROLES.ADMIN, { allowPending: true }), auth_controller_1.AuthController.getMyStatus);
// Additional password management routes
router.post('/forget-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.forgetPasswordSchema), auth_controller_1.AuthController.forgetPassword);
router.post('/reset-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resetPasswordSchema), auth_controller_1.AuthController.resetPassword);
router.post('/change-password', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.changePasswordSchema), auth_controller_1.AuthController.changePassword);
router.post('/claim-admin', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.claimAdminZodSchema), auth_controller_1.AuthController.claimAdmin);
exports.AuthRoutes = router;
//# sourceMappingURL=auth.route.js.map