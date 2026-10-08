"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const admin_controller_1 = require("./admin.controller");
const admin_validation_1 = require("./admin.validation");
const router = express_1.default.Router();
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), admin_controller_1.AdminController.getDashboardStats);
router.get('/monthly-trends', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(admin_validation_1.AdminValidation.monthlyTrendsQuerySchema), admin_controller_1.AdminController.getMonthlyTrends);
router.get('/recent-activities', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(admin_validation_1.AdminValidation.recentActivitiesQuerySchema), admin_controller_1.AdminController.getRecentActivities);
exports.AdminRoutes = router;
//# sourceMappingURL=admin.route.js.map