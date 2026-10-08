import { z } from 'zod';

const createReceiptZodSchema = z.object({
  body: z.object({
    campaignId: z.string().min(1, { message: 'Campaign ID is required' }),
    fileUrl: z.string().url({ message: 'Valid file URL is required' }),
  }),
});

const approveReceiptZodSchema = z.object({
  body: z.object({
    amountEarned: z.number().positive({ message: 'Amount earned must be positive' }),
  }),
});

const rejectReceiptZodSchema = z.object({
  body: z.object({
    rejectionReason: z.string().min(1, { message: 'Rejection reason is required' }),
  }),
});

export const ReceiptValidation = {
  createReceiptZodSchema,
  approveReceiptZodSchema,
  rejectReceiptZodSchema,
};
