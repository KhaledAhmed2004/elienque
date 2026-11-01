"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
const user_controller_1 = require("../user/user.controller");
const user_validation_1 = require("../user/user.validation");
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const booking_controller_1 = require("../booking/booking.controller");
const booking_validation_1 = require("../booking/booking.validation");
const dashboard_controller_1 = require("../dashboard/dashboard.controller");
const provider_route_1 = require("../provider/provider.route");
const admin_controller_1 = require("./admin.controller");
const admin_validation_1 = require("./admin.validation");
const router = express_1.default.Router();
router.get('/analytics/overview', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), dashboard_controller_1.DashboardController.getAdminAnalyticsOverview);
router.get('/bookings', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(booking_validation_1.BookingValidation.listBookingsQueryZodSchema), booking_controller_1.BookingController.listAdminBookings);
router.get('/bookings/:reference', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), booking_controller_1.BookingController.getBookingByReference);
router.get('/settings', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), admin_controller_1.AdminController.getPlatformSettings);
router.patch('/settings/commission', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(admin_validation_1.AdminValidation.updateCommissionZodSchema), admin_controller_1.AdminController.updateCommissionSettings);
router.patch('/settings/platform', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(admin_validation_1.AdminValidation.updatePlatformZodSchema), admin_controller_1.AdminController.updatePlatformInfo);
router.patch('/users/:userId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateProfileZodSchema), user_controller_1.UserController.updateUserById);
router.use('/providers', provider_route_1.ProviderRoutes);
exports.AdminRoutes = router;
//# sourceMappingURL=admin.route.js.map