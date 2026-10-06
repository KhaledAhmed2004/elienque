import { Model, Types } from 'mongoose';
import { CAMPAIGN_STATUS } from '../../../enums/campaign';

export type ICampaign = {
  businessId: Types.ObjectId;
  title: string;
  reward: string;
  offer: string;
  startDate: Date;
  endDate: Date;
  status: CAMPAIGN_STATUS;
};

export type CampaignModel = Model<ICampaign>;

export type ICampaignParticipant = {
  campaignId: Types.ObjectId;
  promoterId: Types.ObjectId;
  referralCode: string;
  joinedAt: Date;
};

export type CampaignParticipantModel = Model<ICampaignParticipant>;
