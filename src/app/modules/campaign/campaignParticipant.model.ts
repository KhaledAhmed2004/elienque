import { model, Schema } from 'mongoose';
import { ICampaignParticipant, CampaignParticipantModel } from './campaign.interface';

const campaignParticipantSchema = new Schema<ICampaignParticipant>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    promoterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
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

// A promoter can only join a specific campaign once
campaignParticipantSchema.index({ campaignId: 1, promoterId: 1 }, { unique: true });

export const CampaignParticipant = model<ICampaignParticipant, CampaignParticipantModel>(
  'CampaignParticipant',
  campaignParticipantSchema,
);
