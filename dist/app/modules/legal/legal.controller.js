"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const legal_service_1 = require("./legal.service");
const createLegalPage = (0, catchAsync_1.default)(async (req, res) => {
    const result = await legal_service_1.LegalService.createLegalPage(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Legal page created successfully',
        data: result,
    });
});
const getAll = (0, catchAsync_1.default)(async (req, res) => {
    const result = await legal_service_1.LegalService.getAll();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Legal pages retrieved successfully',
        data: result,
    });
});
const getById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await legal_service_1.LegalService.getById(req.params.legalId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Legal page retrieved successfully',
        data: result,
    });
});
const updateById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await legal_service_1.LegalService.updateById(req.params.legalId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Legal page updated successfully',
        data: result,
    });
});
const deleteById = (0, catchAsync_1.default)(async (req, res) => {
    await legal_service_1.LegalService.deleteById(req.params.legalId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Legal page deleted successfully',
    });
});
exports.LegalController = {
    createLegalPage,
    getAll,
    getById,
    updateById,
    deleteById,
};
//# sourceMappingURL=legal.controller.js.map