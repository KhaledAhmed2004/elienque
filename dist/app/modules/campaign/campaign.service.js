"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const campaign_model_1 = require("./campaign.model");
const campaignParticipant_model_1 = require("./campaignParticipant.model");
const campaign_1 = require("../../../enums/campaign");
const user_1 = require("../../../enums/user");
const createCampaign = async (user, payload) => {
    const { title, reward, offer, startDate, endDate } = payload;
    const campaign = await campaign_model_1.Campaign.create({
        businessId: user.id,
        title,
        reward,
        offer,
        startDate,
        endDate,
        status: campaign_1.CAMPAIGN_STATUS.DRAFT,
    });
    return campaign;
};
const updateCampaign = async (id, user, payload) => {
    const campaign = await campaign_model_1.Campaign.findById(id);
    if (!campaign) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Campaign not found');
    }
    if (user.role !== user_1.USER_ROLES.ADMIN && campaign.businessId.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only edit your own campaigns');
    }
    if (campaign.status !== campaign_1.CAMPAIGN_STATUS.DRAFT) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only draft campaigns can be modified');
    }
    Object.assign(campaign, payload);
    await campaign.save();
    return campaign;
};
const activateCampaign = async (id, user) => {
    const campaign = await campaign_model_1.Campaign.findById(id);
    if (!campaign) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Campaign not found');
    }
    if (user.role !== user_1.USER_ROLES.ADMIN && campaign.businessId.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only activate your own campaigns');
    }
    if (campaign.status !== campaign_1.CAMPAIGN_STATUS.DRAFT) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Campaign is not in draft status');
    }
    campaign.status = campaign_1.CAMPAIGN_STATUS.ACTIVE;
    await campaign.save();
    return campaign;
};
const getActiveCampaigns = async () => {
    const now = new Date();
    const campaigns = await campaign_model_1.Campaign.find({
        status: campaign_1.CAMPAIGN_STATUS.ACTIVE,
        startDate: { $lte: now },
        endDate: { $gt: now },
    });
    return campaigns;
};
const joinCampaign = async (id, user) => {
    const campaign = await campaign_model_1.Campaign.findById(id);
    if (!campaign) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Campaign not found');
    }
    const now = new Date();
    if (campaign.status !== campaign_1.CAMPAIGN_STATUS.ACTIVE || now < campaign.startDate || now >= campaign.endDate) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Campaign is not active or has expired');
    }
    const existingParticipant = await campaignParticipant_model_1.CampaignParticipant.findOne({
        campaignId: campaign._id,
        promoterId: user.id,
    });
    if (existingParticipant) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'You have already joined this campaign');
    }
    const generateReferralCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };
    const participant = await campaignParticipant_model_1.CampaignParticipant.create({
        campaignId: campaign._id,
        promoterId: user.id,
        referralCode: generateReferralCode(),
    });
    return { referralCode: participant.referralCode };
};
exports.CampaignService = {
    createCampaign,
    updateCampaign,
    activateCampaign,
    getActiveCampaigns,
    joinCampaign,
};
//# sourceMappingURL=campaign.service.js.map