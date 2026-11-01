"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const user_service_1 = require("./user.service");
// ==========================================
// NestJS User Endpoints (/me & /admin-dashboard)
// ==========================================
const getAdminDashboard = (0, catchAsync_1.default)(async (_req, res) => {
    const result = await user_service_1.UserService.getAdminDashboard();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: result,
    });
});
const getProfile = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const result = await user_service_1.UserService.getProfile(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Profile retrieved successfully',
        data: result,
    });
});
const updateUserById = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.params.userId || req.params.id;
    const payload = { ...req.body };
    if (req.file) {
        payload.profilePicture = `/images/${req.file.filename}`;
    }
    const result = await user_service_1.UserService.updateProfile(userId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message || 'User updated successfully',
        data: result.user || result,
    });
});
const updateMyProfile = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const payload = { ...req.body };
    if (req.file) {
        payload.profilePicture = `/images/${req.file.filename}`;
    }
    const result = await user_service_1.UserService.updateProfile(userId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message || 'Profile updated successfully',
        data: result.user || result,
    });
});
const updatePassword = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const result = await user_service_1.UserService.updatePassword(userId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: result,
    });
});
const getUserSessions = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const result = await user_service_1.UserService.getUserSessions(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User sessions retrieved successfully',
        data: result,
    });
});
const revokeSession = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const sessionId = req.params.id || req.params.sessionId;
    const result = await user_service_1.UserService.revokeSession(userId, sessionId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: result,
    });
});
// ==========================================
// Platform Admin User Management (Tier 3)
// ==========================================
const getAllUsers = (0, catchAsync_1.default)(async (req, res) => {
    const result = await user_service_1.UserService.getAllUsers(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Users retrieved successfully',
        pagination: result.pagination,
        data: result.data,
    });
});
const getUserById = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const result = await user_service_1.UserService.getUserById(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User retrieved successfully',
        data: result,
    });
});
const updateUserStatus = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const { status, reason } = req.body;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.updateUserStatus(id, status, reason, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User status updated successfully',
        data: result,
    });
});
const suspendUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const { reason } = req.body;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.suspendUser(id, reason, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User suspended successfully',
        data: result,
    });
});
const reactivateUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.reactivateUser(id, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User reactivated successfully',
        data: result,
    });
});
const deleteUserByAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.params;
    const result = await user_service_1.UserService.deleteUserByAdmin(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User deleted successfully',
        data: result,
    });
});
const deleteAccount = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.id || user.userId || user._id;
    const result = await user_service_1.UserService.deleteAccountFromDB(userId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Account deleted successfully',
        data: result,
    });
});
const getUserStats = (0, catchAsync_1.default)(async (_req, res) => {
    const result = await user_service_1.UserService.getUserStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User statistics retrieved successfully',
        data: result,
    });
});
exports.UserController = {
    getAdminDashboard,
    getProfile,
    updateMyProfile,
    updateUserById,
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
    deleteAccount,
    deleteUserByAdmin,
    getUserStats,
    // Backward compatibility
    getUserProfile: getProfile,
    updateProfile: updateMyProfile,
};
//# sourceMappingURL=user.controller.js.map