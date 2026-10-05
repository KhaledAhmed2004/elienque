import { z } from 'zod';
import { SUBSCRIPTION_PLAN } from './subscription.interface';

const planEnum = z.nativeEnum(SUBSCRIPTION_PLAN);

export const SubscriptionValidation = {
  createCheckoutSessionSchema: z
    .object({
      body: z.object({
        plan: planEnum,
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    })
    .describe('SubscriptionCheckoutSchema'),

  createPortalSessionSchema: z
    .object({
      body: z.object({
        returnUrl: z.string().url().optional(),
      }),
      params: z.object({}).optional(),
      query: z.object({}).optional(),
    })
    .describe('SubscriptionPortalSchema'),

  verifyAppleSchema: z
    .object({
      body: z.object({
        receipt: z
          .string({ required_error: 'Receipt data is required' })
          .min(1, 'Receipt data cannot be empty'),
      }),
    })
    .describe('VerifyAppleReceiptSchema'),

  verifyGoogleSchema: z
    .object({
      body: z.object({
        purchaseToken: z
          .string({ required_error: 'purchaseToken is required' })
          .min(1, 'purchaseToken cannot be empty'),
        productId: z
          .string({ required_error: 'productId is required' })
          .min(1, 'productId cannot be empty'),
        orderId: z.string().optional().default(''),
      }),
    })
    .describe('VerifyGooglePurchaseSchema'),

  restoreSchema: z
    .object({
      body: z
        .object({
          receipt: z.string().optional(),
          purchaseToken: z.string().optional(),
        })
        .optional()
        .default({}),
    })
    .describe('RestorePurchasesSchema'),
};