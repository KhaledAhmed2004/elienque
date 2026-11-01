"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const lead_service_1 = require("./lead.service");
const submitLead = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const promoterId = user?.id || user?._id || user?.userId;
    const result = await lead_service_1.LeadService.submitLead(promoterId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Business lead submitted successfully',
        data: result,
    });
});
const getAllLeads = (0, catchAsync_1.default)(async (req, res) => {
    const { meta, result } = await lead_service_1.LeadService.getAllLeads(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Business leads retrieved successfully',
        pagination: meta,
        data: result,
    });
});
const getMyLeads = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const promoterId = user?.id || user?._id || user?.userId;
    const { meta, result } = await lead_service_1.LeadService.getMyLeads(promoterId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Your leads retrieved successfully',
        pagination: meta,
        data: result,
    });
});
const getSingleLead = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user?.id || user?._id || user?.userId;
    const userRole = user?.role;
    const result = await lead_service_1.LeadService.getSingleLead(req.params.id, userRole, userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Lead retrieved successfully',
        data: result,
    });
});
const updateLeadStatus = (0, catchAsync_1.default)(async (req, res) => {
    const result = await lead_service_1.LeadService.updateLeadStatus(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Lead status updated successfully',
        data: result,
    });
});
exports.LeadController = {
    submitLead,
    getAllLeads,
    getMyLeads,
    getSingleLead,
    updateLeadStatus,
};
//# sourceMappingURL=lead.controller.js.map