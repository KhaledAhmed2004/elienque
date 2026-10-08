import { z } from 'zod';
import { LeadStatus } from './lead.interface';

const createLeadZodSchema = z.object({
  body: z.object({
    businessName: z.string('Business Name is required'),
    ownerName: z.string('Owner Name is required'),
    phone: z.string('Phone is required'),
    email: z.email({
      error: (iss) => iss.input === undefined ? 'Email is required' : 'Invalid email format'
    }),
    address: z.string('Address is required'),
  }),
});

const updateLeadStatusZodSchema = z.object({
  body: z.object({
    status: z.enum([...Object.values(LeadStatus)] as [string, ...string[]], 'Status is required'),
    adminNote: z.string().optional(),
    rejectReason: z.string().optional(),
  }),
});

export const LeadValidation = {
  createLeadZodSchema,
  updateLeadStatusZodSchema,
};
