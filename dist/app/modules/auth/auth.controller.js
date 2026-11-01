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
const registerUser = (0, catchAsync_1.default)(async (req, res) => {
    const userData = req.body;
    const result = await auth_service_1.AuthService.registerUser(userData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: result.message,
        data: result,
    });
});
const verifyEmail = (0, catchAsync_1.default)(async (req, res) => {
    const verifyData = req.body;
    const result = await auth_service_1.AuthService.verifyEmail(verifyData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: result.data,
    });
});
const resendVerification = (0, catchAsync_1.default)(async (req, res) => {
    const email = req.body.email;
    const result = await auth_service_1.AuthService.resendVerificationEmail(email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: null,
    });
});
const loginUser = (0, catchAsync_1.default)(async (req, res) => {
    const loginData = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const result = await auth_service_1.AuthService.loginUser(loginData, ip, deviceInfo);
    // Set refresh token in httpOnly cookie
    if (result?.tokens?.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/',
        });
    }
    const isMobileClient = req.headers['x-client-type'] === 'mobile';
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User logged in successfully.',
        data: {
            accessToken: result.tokens.accessToken,
            ...(isMobileClient ? { refreshToken: result.tokens.refreshToken } : {}),
            sessionId: result.sessionId,
            user: result.user,
            isApproved: result.isApproved,
        },
    });
});
const refreshToken = (0, catchAsync_1.default)(async (req, res) => {
    const cookieToken = req.cookies?.refreshToken;
    const bodyToken = req.body?.refreshToken;
    const bodySessionId = req.body?.sessionId;
    const token = bodyToken || cookieToken || '';
    const ip = req.ip || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const result = await auth_service_1.AuthService.refreshToken(bodySessionId || token, token, ip, deviceInfo);
    // Rotate refresh token cookie
    if (result?.tokens?.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/',
        });
    }
    const isMobileClient = req.headers['x-client-type'] === 'mobile';
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Token refreshed successfully.',
        data: {
            accessToken: result.tokens.accessToken,
            ...(isMobileClient ? { refreshToken: result.tokens.refreshToken } : {}),
            sessionId: result.sessionId,
        },
    });
});
// Logout Single Session
const logoutUser = (0, catchAsync_1.default)(async (req, res) => {
    const { deviceToken, sessionId } = req.body;
    const user = req.user;
    await auth_service_1.AuthService.logoutUser(user, sessionId, deviceToken);
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
// Logout All Sessions
const logoutAll = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    await auth_service_1.AuthService.logoutAll(user.id);
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Logged out from all devices.',
    });
});
// Get Current User Status
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
// Forgot Password
const forgotPassword = (0, catchAsync_1.default)(async (req, res) => {
    const email = req.body.email;
    const result = await auth_service_1.AuthService.forgotPassword(email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: null,
    });
});
// Reset Password
const resetPassword = (0, catchAsync_1.default)(async (req, res) => {
    const rawToken = req.headers.authorization || '';
    const resetData = req.body;
    const result = await auth_service_1.AuthService.resetPassword(rawToken, resetData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: null,
    });
});
// Change Password
const changePassword = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const passwordData = req.body;
    const result = await auth_service_1.AuthService.changePassword(user, passwordData);
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
    });
});
// Claim Admin
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
    verifyEmail,
    resendVerification,
    loginUser,
    refreshToken,
    logoutUser,
    logoutAll,
    getMyStatus,
    forgotPassword,
    resetPassword,
    changePassword,
    claimAdmin,
};
//# sourceMappingURL=auth.controller.js.map