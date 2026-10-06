import { z } from 'zod';

const createLeadZodSchema = z.object({
  body: z.object({
    businessName: z.string({ error: 'Business Name is required' }),
    ownerName: z.string({ error: 'Owner Name is required' }),
    phone: z.string({ error: 'Phone is required' }),
    email: z
      .string({ error: 'Email is required' })
      .email({ message: 'Invalid email format' }),
    address: z.string({ error: 'Address is required' }),
  }),
});

export const LeadValidation = {
  createLeadZodSchema,
};
