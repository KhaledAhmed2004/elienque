"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const admin_service_1 = require("./admin.service");
const getDashboardStats = (0, catchAsync_1.default)(async (_req, res) => {
    const result = await admin_service_1.AdminService.getAdminDashboardStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Admin dashboard stats',
        data: result,
    });
});
const getMonthlyTrends = (0, catchAsync_1.default)(async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const range = req.query.range;
    const metric = req.query.metric;
    const result = await admin_service_1.AdminService.getMonthlyTrends({ year, range, metric });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Monthly trends retrieved successfully',
        data: result,
    });
});
const getRecentActivities = (0, catchAsync_1.default)(async (req, res) => {
    const limit = Number(req.query.limit) || 5;
    const result = await admin_service_1.AdminService.getRecentActivities(limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Recent activities retrieved successfully',
        data: result,
    });
});
exports.AdminController = {
    getDashboardStats,
    getMonthlyTrends,
    getRecentActivities,
};
//# sourceMappingURL=admin.controller.js.map