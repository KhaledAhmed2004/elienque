"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const auth_service_1 = require("./auth.service");
// 2.1 Register User
const registerUser = (0, catchAsync_1.default)(async (req, res) => {
    const userData = req.body;
    const result = await auth_service_1.AuthService.registerUser(userData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Registration successful. Please check your email to verify your account.',
        data: result,
    });
});
// 2.2 Verify OTP
const verifyOtp = (0, catchAsync_1.default)(async (req, res) => {
    const verifyData = req.body;
    const result = await auth_service_1.AuthService.verifyOtp(verifyData);
    let responseData = result.data;
    // Set refresh token in httpOnly cookie for better security if tokens exist
    if (typeof result.data !== 'string' && result.tokens) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        responseData = {
            accessToken: result.tokens.accessToken,
            isApproved: result.data.isApproved ?? false,
        };
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: responseData,
    });
});
// 2.3 Resend OTP
const resendOtp = (0, catchAsync_1.default)(async (req, res) => {
    const result = await auth_service_1.AuthService.resendOtp(req.body.email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: null,
    });
});
// 2.4 Login
const loginUser = (0, catchAsync_1.default)(async (req, res) => {
    const loginData = req.body;
    const result = await auth_service_1.AuthService.loginUser(loginData);
    // Set refresh token in httpOnly cookie for better security
    if (result?.tokens?.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
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
const refreshToken = (0, catchAsync_1.default)(async (req, res) => {
    // Prefer reading refresh token from cookie; fallback to body if present
    const cookieToken = req.cookies?.refreshToken;
    const bodyToken = req.body?.refreshToken;
    const token = cookieToken || bodyToken || '';
    const result = await auth_service_1.AuthService.refreshToken(token);
    // Rotate refresh token in httpOnly cookie
    if (result?.tokens?.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            path: '/',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Token refreshed successfully.',
        data: result.tokens,
    });
});
// 2.6 Logout
const logoutUser = (0, catchAsync_1.default)(async (req, res) => {
    const { deviceToken } = req.body;
    const user = req.user;
    await auth_service_1.AuthService.logoutUser(user, deviceToken);
    // Clear refresh token cookie on logout
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User logged out successfully.',
    });
});
// 2.7 Get Current User Profile / Status
const getMyStatus = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await auth_service_1.AuthService.getMyStatus(user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Account status retrieved.',
        data: result,
    });
});
// Additional Password Management
const forgetPassword = (0, catchAsync_1.default)(async (req, res) => {
    const email = req.body.email;
    const result = await auth_service_1.AuthService.forgetPassword(email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: null,
    });
});
const resetPassword = (0, catchAsync_1.default)(async (req, res) => {
    const rawToken = req.headers.authorization || '';
    const token = rawToken.replace(/^Bearer\s+/i, '').trim();
    const resetData = req.body;
    const result = await auth_service_1.AuthService.resetPassword(token, resetData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Your password has been successfully reset.',
        data: result,
    });
});
const changePassword = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const passwordData = req.body;
    await auth_service_1.AuthService.changePassword(user, passwordData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Your password has been successfully changed',
    });
});
const claimAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const claimData = req.body;
    const result = await auth_service_1.AuthService.claimAdmin(user, claimData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Admin account credentials updated successfully.',
        data: result,
    });
});
exports.AuthController = {
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
//# sourceMappingURL=auth.controller.js.map