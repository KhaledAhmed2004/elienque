import { model, Schema } from 'mongoose';
import { CAMPAIGN_STATUS } from '../../../enums/campaign';
import { ICampaign, CampaignModel } from './campaign.interface';

const campaignSchema = new Schema<ICampaign>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    reward: {
      type: String,
      required: true,
      trim: true,
    },
    offer: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.DRAFT,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  },
);

export const Campaign = model<ICampaign, CampaignModel>('Campaign', campaignSchema);
