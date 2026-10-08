"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const support_service_1 = require("./support.service");
exports.SupportController = {
    createSupport: (0, catchAsync_1.default)(async (req, res) => {
        const user = req.user;
        const result = await support_service_1.SupportService.createSupport(user.id, req.body);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.CREATED,
            message: 'Support ticket created successfully',
            data: result,
        });
    }),
    getAllSupports: (0, catchAsync_1.default)(async (req, res) => {
        const result = await support_service_1.SupportService.getAllSupports(req.query);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Support tickets retrieved successfully',
            pagination: result.pagination,
            data: result.data,
        });
    }),
    getMyTickets: (0, catchAsync_1.default)(async (req, res) => {
        const user = req.user;
        const result = await support_service_1.SupportService.getMyTickets(user.id, req.query);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'My support tickets retrieved successfully',
            pagination: result.pagination,
            data: result.data,
        });
    }),
    getSupportById: (0, catchAsync_1.default)(async (req, res) => {
        const result = await support_service_1.SupportService.getSupportById(req.params.id);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Support ticket retrieved successfully',
            data: result,
        });
    }),
    addMessage: (0, catchAsync_1.default)(async (req, res) => {
        const user = req.user;
        const result = await support_service_1.SupportService.addMessage(req.params.id, user.id, req.body.message);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Message sent successfully',
            data: result,
        });
    }),
    deleteSupport: (0, catchAsync_1.default)(async (req, res) => {
        const result = await support_service_1.SupportService.deleteSupport(req.params.id);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Support ticket deleted successfully',
            data: result,
        });
    }),
};
//# sourceMappingURL=support.controller.js.map