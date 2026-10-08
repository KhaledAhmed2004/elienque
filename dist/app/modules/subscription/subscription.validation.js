"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionValidation = void 0;
const zod_1 = require("zod");
const subscription_interface_1 = require("./subscription.interface");
const planEnum = zod_1.z.nativeEnum(subscription_interface_1.SUBSCRIPTION_PLAN);
exports.SubscriptionValidation = {
    createCheckoutSessionSchema: zod_1.z
        .object({
        body: zod_1.z.object({
            plan: planEnum,
            successUrl: zod_1.z.string().url().optional(),
            cancelUrl: zod_1.z.string().url().optional(),
        }),
        params: zod_1.z.object({}).optional(),
        query: zod_1.z.object({}).optional(),
    })
        .describe('SubscriptionCheckoutSchema'),
    createPortalSessionSchema: zod_1.z
        .object({
        body: zod_1.z.object({
            returnUrl: zod_1.z.string().url().optional(),
        }),
        params: zod_1.z.object({}).optional(),
        query: zod_1.z.object({}).optional(),
    })
        .describe('SubscriptionPortalSchema'),
    verifyAppleSchema: zod_1.z
        .object({
        body: zod_1.z.object({
            receipt: zod_1.z.string().min(1, 'Receipt data is required'),
        }),
    })
        .describe('VerifyAppleReceiptSchema'),
    verifyGoogleSchema: zod_1.z
        .object({
        body: zod_1.z.object({
            purchaseToken: zod_1.z.string().min(1, 'purchaseToken is required'),
            productId: zod_1.z.string().min(1, 'productId is required'),
            orderId: zod_1.z.string().optional().default(''),
        }),
    })
        .describe('VerifyGooglePurchaseSchema'),
    restoreSchema: zod_1.z
        .object({
        body: zod_1.z
            .object({
            receipt: zod_1.z.string().optional(),
            purchaseToken: zod_1.z.string().optional(),
        })
            .optional()
            .default({}),
    })
        .describe('RestorePurchasesSchema'),
};
//# sourceMappingURL=subscription.validation.js.map