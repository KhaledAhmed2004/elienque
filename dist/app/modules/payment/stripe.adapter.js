"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRefundForIntent = exports.createTransfer = exports.retrievePaymentIntent = exports.createPaymentIntent = exports.deleteAccount = exports.retrieveAccount = exports.createOnboardingLink = exports.createExpressAccount = void 0;
const stripe_1 = require("../../../config/stripe");
const createExpressAccount = async (params) => {
    try {
        const account = await stripe_1.stripe.accounts.create({
            type: 'express',
            country: 'US',
            email: params.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
            individual: {
                first_name: params.firstName,
                last_name: params.lastName || '',
                email: params.email,
                dob: params.dob,
                address: {
                    city: params.city,
                    country: 'US',
                },
            },
            metadata: params.metadata,
        });
        return account;
    }
    catch (error) {
        throw new Error(`createExpressAccount failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createExpressAccount = createExpressAccount;
const createOnboardingLink = async (accountId, refreshUrl, returnUrl) => {
    try {
        const accountLink = await stripe_1.stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
        });
        return accountLink.url;
    }
    catch (error) {
        throw new Error(`createOnboardingLink failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createOnboardingLink = createOnboardingLink;
const retrieveAccount = async (accountId) => {
    try {
        return await stripe_1.stripe.accounts.retrieve(accountId);
    }
    catch (error) {
        throw new Error(`retrieveAccount failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.retrieveAccount = retrieveAccount;
const deleteAccount = async (accountId) => {
    try {
        return await stripe_1.stripe.accounts.del(accountId);
    }
    catch (error) {
        throw new Error(`deleteAccount failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.deleteAccount = deleteAccount;
const createPaymentIntent = async (params) => {
    try {
        const intent = await stripe_1.stripe.paymentIntents.create({
            amount: (0, stripe_1.dollarsToCents)(params.amountDollars),
            currency: params.currency || stripe_1.DEFAULT_CURRENCY,
            automatic_payment_methods: { enabled: true },
            capture_method: params.captureMethod || 'manual',
            metadata: params.metadata,
        });
        return intent;
    }
    catch (error) {
        throw new Error(`createPaymentIntent failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createPaymentIntent = createPaymentIntent;
const retrievePaymentIntent = async (intentId) => {
    try {
        return await stripe_1.stripe.paymentIntents.retrieve(intentId);
    }
    catch (error) {
        throw new Error(`retrievePaymentIntent failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.retrievePaymentIntent = retrievePaymentIntent;
const createTransfer = async (params) => {
    try {
        const transfer = await stripe_1.stripe.transfers.create({
            amount: (0, stripe_1.dollarsToCents)(params.amountDollars),
            currency: params.currency || stripe_1.DEFAULT_CURRENCY,
            destination: params.destinationAccountId,
            source_transaction: params.sourceChargeId,
            metadata: params.metadata,
        });
        return transfer;
    }
    catch (error) {
        throw new Error(`createTransfer failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createTransfer = createTransfer;
const createRefundForIntent = async (intentId, reason) => {
    try {
        const refund = await stripe_1.stripe.refunds.create({
            payment_intent: intentId,
            reason: reason,
        });
        return refund;
    }
    catch (error) {
        throw new Error(`createRefundForIntent failed: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createRefundForIntent = createRefundForIntent;
//# sourceMappingURL=stripe.adapter.js.map