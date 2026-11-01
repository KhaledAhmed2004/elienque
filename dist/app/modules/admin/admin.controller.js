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
const getPlatformSettings = (0, catchAsync_1.default)(async (_req, res) => {
    const result = await admin_service_1.AdminService.getPlatformSettings();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Platform settings retrieved successfully',
        data: result,
    });
});
const updateCommissionSettings = (0, catchAsync_1.default)(async (req, res) => {
    const payload = req.body;
    const result = await admin_service_1.AdminService.updateCommissionSettings(payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Platform commission settings updated successfully',
        data: result,
    });
});
const updatePlatformInfo = (0, catchAsync_1.default)(async (req, res) => {
    const payload = req.body;
    const result = await admin_service_1.AdminService.updatePlatformInfo(payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Platform info updated successfully',
        data: result,
    });
});
exports.AdminController = {
    getPlatformSettings,
    updateCommissionSettings,
    updatePlatformInfo,
};
//# sourceMappingURL=admin.controller.js.map