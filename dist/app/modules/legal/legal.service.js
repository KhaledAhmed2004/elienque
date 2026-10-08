"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const legal_model_1 = require("./legal.model");
const createLegalPage = async (payload) => {
    const result = await legal_model_1.LegalPage.create(payload);
    return result;
};
const getAll = async () => {
    const result = await legal_model_1.LegalPage.find()
        .select('-content')
        .sort({ createdAt: -1 })
        .lean();
    return result;
};
const getById = async (legalId) => {
    const result = await legal_model_1.LegalPage.findById(legalId).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
    return result;
};
const updateById = async (legalId, payload) => {
    const result = await legal_model_1.LegalPage.findByIdAndUpdate(legalId, payload, {
        new: true,
        runValidators: true,
    }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
    return result;
};
const deleteById = async (legalId) => {
    const result = await legal_model_1.LegalPage.findByIdAndDelete(legalId);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
};
exports.LegalService = {
    createLegalPage,
    getAll,
    getById,
    updateById,
    deleteById,
};
//# sourceMappingURL=legal.service.js.map