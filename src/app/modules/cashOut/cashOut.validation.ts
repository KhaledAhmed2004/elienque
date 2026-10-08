import { z } from 'zod';

const requestCashOutZodSchema = z.object({
  body: z.object({
    amount: z.number().min(50, { message: 'Minimum cash out amount is $50' }),
    paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
    paymentDetails: z.any().refine(data => typeof data === 'object' && Object.keys(data).length > 0, {
      message: 'Payment details are required',
    }),
  }),
});

const approveCashOutZodSchema = z.object({
  body: z.object({
    transactionReference: z.string().min(1, { message: 'Transaction reference is required' }),
  }),
});

const rejectCashOutZodSchema = z.object({
  body: z.object({
    rejectionReason: z.string().min(1, { message: 'Rejection reason is required' }),
  }),
});

export const CashOutValidation = {
  requestCashOutZodSchema,
  approveCashOutZodSchema,
  rejectCashOutZodSchema,
};
