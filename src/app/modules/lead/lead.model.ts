import { Schema, model } from 'mongoose';
import { IBusinessLead, LeadStatus } from './lead.interface';

const businessLeadSchema = new Schema<IBusinessLead>(
  {
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    promoterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.PENDING,
    },
    adminNote: { type: String, default: null },
    rejectReason: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

export const BusinessLead = model<IBusinessLead>(
  'BusinessLead',
  businessLeadSchema,
);
