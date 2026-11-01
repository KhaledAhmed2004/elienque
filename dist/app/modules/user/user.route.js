"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const fileHandler_1 = require("../../middlewares/fileHandler");
const rateLimit_1 = require("../../middlewares/rateLimit");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const ALL_ROLES = [
    user_1.USER_ROLES.USER,
    user_1.USER_ROLES.OPERATOR,
    user_1.USER_ROLES.ADMIN,
];
// Get aggregated admin dashboard metrics and overview
router.get('/admin-dashboard', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getAdminDashboard);
// Get current authenticated user profile and details
router.get('/me', (0, auth_1.default)(...ALL_ROLES), user_controller_1.UserController.getProfile);
// Update user profile
router.patch('/me', (0, auth_1.default)(...ALL_ROLES), (0, fileHandler_1.fileHandler)([{ name: 'profilePicture', maxCount: 1 }]), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateMyProfile);
// Change password for authenticated user and invalidate active sessions
router.patch('/me/password', (0, auth_1.default)(...ALL_ROLES), (0, validateRequest_1.default)(user_validation_1.UserValidation.updatePasswordZodSchema), user_controller_1.UserController.updatePassword);
router.post('/me/password', (0, auth_1.default)(...ALL_ROLES), (0, validateRequest_1.default)(user_validation_1.UserValidation.updatePasswordZodSchema), user_controller_1.UserController.updatePassword);
// Get list of active login sessions for current user
router.get('/me/sessions', (0, auth_1.default)(...ALL_ROLES), user_controller_1.UserController.getUserSessions);
// Revoke a specific active session by session ID
router.delete('/me/sessions/:id', (0, auth_1.default)(...ALL_ROLES), user_controller_1.UserController.revokeSession);
// Get user profile (alias for /me)
router.get('/profile', (0, auth_1.default)(...ALL_ROLES), user_controller_1.UserController.getProfile);
// Update user profile (alias for /me)
router.patch('/profile', (0, auth_1.default)(...ALL_ROLES), (0, fileHandler_1.fileHandler)([{ name: 'profilePicture', maxCount: 1 }]), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateMyProfile);
// Self-delete or deactivate current authenticated user account
router.delete('/delete-account', (0, auth_1.default)(...ALL_ROLES), (0, validateRequest_1.default)(user_validation_1.UserValidation.deleteUserZodSchema), user_controller_1.UserController.deleteAccount);
// Get platform-wide user statistics for admin management
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getUserStats);
// Get paginated list of all users with search and filter queries
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getAllUsers);
// Get detailed user profile by user ID
// Update user profile by ID (admin only)
router.patch('/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateUserById);
router.get('/:userId', (0, auth_1.default)(...ALL_ROLES), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-details',
}), user_controller_1.UserController.getUserById);
// Update account status for a specific user (admin only)
router.patch('/:userId/status', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateStatusZodSchema), user_controller_1.UserController.updateUserStatus);
// Suspend a user account with reason (admin only)
router.patch('/:userId/suspend', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.suspendUserZodSchema), user_controller_1.UserController.suspendUser);
// Reactivate a suspended or deactivated user account (admin only)
router.patch('/:userId/reactivate', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.reactivateUser);
// Block user account access (admin only)
router.patch('/:userId/block', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.blockUserZodSchema), user_controller_1.UserController.blockUser);
// Unblock user account access (admin only)
router.patch('/:userId/unblock', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.unblockUser);
// Permanently delete or soft-delete user account (admin only)
router.delete('/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.deleteUserByAdmin);
exports.UserRoutes = router;
//# sourceMappingURL=user.route.js.map