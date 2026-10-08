"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const campaign_service_1 = require("./campaign.service");
const createCampaign = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await campaign_service_1.CampaignService.createCampaign(user, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Campaign created successfully',
        data: result,
    });
});
const updateCampaign = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.id;
    const user = req.user;
    const result = await campaign_service_1.CampaignService.updateCampaign(id, user, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Campaign updated successfully',
        data: result,
    });
});
const activateCampaign = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.id;
    const user = req.user;
    const result = await campaign_service_1.CampaignService.activateCampaign(id, user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Campaign activated successfully',
        data: result,
    });
});
const getActiveCampaigns = (0, catchAsync_1.default)(async (req, res) => {
    const result = await campaign_service_1.CampaignService.getActiveCampaigns();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Active campaigns retrieved successfully',
        data: result,
    });
});
const joinCampaign = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.id;
    const user = req.user;
    const result = await campaign_service_1.CampaignService.joinCampaign(id, user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Successfully joined the campaign',
        data: result,
    });
});
exports.CampaignController = {
    createCampaign,
    updateCampaign,
    activateCampaign,
    getActiveCampaigns,
    joinCampaign,
};
//# sourceMappingURL=campaign.controller.js.map