import { Schema, model } from 'mongoose';
import { IBusinessLead, LeadStatus } from './lead.interface';

const businessLeadSchema = new Schema<IBusinessLead>(
  {
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    promoterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.PENDING,
    },
  },
  {
    timestamps: true,
  },
);

export const BusinessLead = model<IBusinessLead>('BusinessLead', businessLeadSchema);
