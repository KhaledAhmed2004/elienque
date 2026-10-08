import { z } from 'zod';

const createCampaignZodSchema = z.object({
  body: z.object({
    businessId: z.string().optional(),
    title: z.string().min(1, { message: 'Title is required' }),
    reward: z.string().min(1, { message: 'Reward is required' }),
    offer: z.string().min(1, { message: 'Offer is required' }),
    startDate: z.string().min(1, { message: 'Start Date is required' })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid start date format',
      }),
    endDate: z.string().min(1, { message: 'End Date is required' })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid end date format',
      }),
    minimumSpend: z.number().min(0, { message: 'Minimum spend must be a non-negative number' }),
  }).refine(data => new Date(data.startDate) < new Date(data.endDate), {
    message: 'Start Date must be before End Date',
    path: ['startDate'],
  }),
});

const updateCampaignZodSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    reward: z.string().min(1).optional(),
    offer: z.string().min(1).optional(),
    startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid start date format',
    }).optional(),
    endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid end date format',
    }).optional(),
    minimumSpend: z.number().min(0).optional(),
  }),
});

export const CampaignValidation = {
  createCampaignZodSchema,
  updateCampaignZodSchema,
};
