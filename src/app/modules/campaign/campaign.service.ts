import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { Campaign } from './campaign.model';
import { CampaignParticipant } from './campaignParticipant.model';
import { CAMPAIGN_STATUS } from '../../../enums/campaign';
import { USER_ROLES } from '../../../enums/user';

const createCampaign = async (user: JwtPayload, payload: any) => {
  const { title, reward, offer, startDate, endDate, businessId } = payload;
  
  let targetBusinessId = user.id;

  if (user.role === USER_ROLES.ADMIN) {
    if (!businessId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Business ID is required for Admin');
    }
    // Verify business exists and is a business owner
    const User = require('../user/user.model').User;
    const business = await User.findById(businessId);
    if (!business || business.role !== USER_ROLES.BUSINESS_OWNER) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Business owner not found');
    }
    targetBusinessId = businessId;
  }

  const campaign = await Campaign.create({
    businessId: targetBusinessId,
    title,
    reward,
    offer,
    startDate,
    endDate,
    status: CAMPAIGN_STATUS.DRAFT,
  });

  return campaign;
};

const updateCampaign = async (id: string, user: JwtPayload, payload: any) => {
  const campaign = await Campaign.findById(id);

  if (!campaign) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Campaign not found');
  }

  if (user.role !== USER_ROLES.ADMIN && campaign.businessId.toString() !== user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only edit your own campaigns');
  }

  if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only draft campaigns can be modified');
  }

  Object.assign(campaign, payload);
  await campaign.save();

  return campaign;
};

const activateCampaign = async (id: string, user: JwtPayload) => {
  const campaign = await Campaign.findById(id);

  if (!campaign) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Campaign not found');
  }

  if (user.role === USER_ROLES.ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Admin cannot activate campaigns directly. Business owner approval is required.');
  }

  if (campaign.businessId.toString() !== user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only activate your own campaigns');
  }

  if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Campaign is not in draft status');
  }

  campaign.status = CAMPAIGN_STATUS.ACTIVE;
  await campaign.save();

  return campaign;
};

const getActiveCampaigns = async () => {
  const now = new Date();
  
  const campaigns = await Campaign.find({
    status: CAMPAIGN_STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gt: now },
  });

  return campaigns;
};

const joinCampaign = async (id: string, user: JwtPayload) => {
  const campaign = await Campaign.findById(id);

  if (!campaign) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Campaign not found');
  }

  const now = new Date();

  if (campaign.status !== CAMPAIGN_STATUS.ACTIVE || now < campaign.startDate || now >= campaign.endDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Campaign is not active or has expired');
  }

  const existingParticipant = await CampaignParticipant.findOne({
    campaignId: campaign._id,
    promoterId: user.id,
  });

  if (existingParticipant) {
    throw new ApiError(StatusCodes.CONFLICT, 'You have already joined this campaign');
  }

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const participant = await CampaignParticipant.create({
    campaignId: campaign._id,
    promoterId: user.id,
    referralCode: generateReferralCode(),
  });

  return { referralCode: participant.referralCode };
};

export const CampaignService = {
  createCampaign,
  updateCampaign,
  activateCampaign,
  getActiveCampaigns,
  joinCampaign,
};
