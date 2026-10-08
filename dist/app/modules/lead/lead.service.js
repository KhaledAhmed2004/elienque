"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const lead_model_1 = require("./lead.model");
const submitLead = async (promoterId, payload) => {
    // Enforce unique phone and email (AC-2)
    const existingLead = await lead_model_1.BusinessLead.findOne({
        $or: [{ phone: payload.phone }, { email: payload.email }],
    });
    if (existingLead) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'A lead with this phone or email already exists.');
    }
    // Create lead (AC-1, AC-4)
    const result = await lead_model_1.BusinessLead.create({
        ...payload,
        promoterId,
    });
    return result;
};
exports.LeadService = {
    submitLead,
};
//# sourceMappingURL=lead.service.js.map