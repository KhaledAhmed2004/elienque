import { z } from 'zod';

const createDraftZodSchema = z.object({
  body: z.object({
    targetType: z.enum(['BUSINESS_PROFILE', 'CAMPAIGN']),
    targetId: z.string({
      required_error: 'targetId is required',
    }),
    changes: z.record(z.any(), {
      required_error: 'changes object is required',
    }),
  }),
});

const updateDraftZodSchema = z.object({
  body: z.object({
    changes: z.record(z.any(), {
      required_error: 'changes object is required',
    }),
  }),
});

const rejectDraftZodSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const DraftValidation = {
  createDraftZodSchema,
  updateDraftZodSchema,
  rejectDraftZodSchema,
};
