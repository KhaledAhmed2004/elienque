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
router.get('/profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), user_controller_1.UserController.getUserProfile);
router.patch('/profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, fileHandler_1.fileHandler)([{ name: 'profilePicture', maxCount: 1 }]), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateUserZodSchema), user_controller_1.UserController.updateProfile);
router.delete('/delete-account', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(user_validation_1.UserValidation.deleteUserZodSchema), user_controller_1.UserController.deleteAccount);
router.get('/my-reviews', (0, auth_1.default)(user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), user_controller_1.UserController.getMyReviews);
router.get('/chauffeurs', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), user_controller_1.UserController.searchChauffeurs);
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getUserStats);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getAllUserRoles);
router.patch('/:userId/approve', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.approveUser);
router.patch('/:userId/reject', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.rejectUserZodSchema), user_controller_1.UserController.rejectUser);
router.patch('/:userId/suspend', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.suspendUserZodSchema), user_controller_1.UserController.suspendUser);
router.patch('/:userId/reactivate', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.reactivateUser);
// Backward compatibility aliases
router.patch('/:userId/block', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.blockUserZodSchema), user_controller_1.UserController.blockUser);
router.patch('/:userId/unblock', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.unblockUser);
router.get('/:userId/reviews', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-reviews',
}), user_controller_1.UserController.getUserReviews);
router.get('/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-details',
}), user_controller_1.UserController.getUserDetailsById);
router.delete('/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.deleteUserByAdmin);
exports.UserRoutes = router;
//# sourceMappingURL=user.route.js.map