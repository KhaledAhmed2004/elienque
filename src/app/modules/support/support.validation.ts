import { z } from 'zod';

const createSupportZodSchema = z.object({
  body: z.object({
    subject: z.string({ required_error: 'Subject is required' }).min(1),
    message: z.string({ required_error: 'Message is required' }).min(1),
  }),
});

const addMessageZodSchema = z.object({
  body: z.object({
    message: z.string({ required_error: 'Message is required' }).min(1),
  }),
});

export const SupportValidation = {
  createSupportZodSchema,
  addMessageZodSchema,
};
