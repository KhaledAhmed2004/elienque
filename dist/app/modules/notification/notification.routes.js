"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const notification_controller_1 = require("./notification.controller");
const notification_validation_1 = require("./notification.validation");
const router = express_1.default.Router();
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(notification_validation_1.NotificationValidation.listNotificationsSchema), notification_controller_1.NotificationController.listMyNotifications);
router.patch('/:notificationId/read', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(notification_validation_1.NotificationValidation.markReadSchema), notification_controller_1.NotificationController.markRead);
router.patch('/read-all', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(notification_validation_1.NotificationValidation.markAllReadSchema), notification_controller_1.NotificationController.markAllRead);
router.delete('/:notificationId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(notification_validation_1.NotificationValidation.paramIdSchema), notification_controller_1.NotificationController.deleteNotification);
exports.NotificationRoutes = router;
//# sourceMappingURL=notification.routes.js.map