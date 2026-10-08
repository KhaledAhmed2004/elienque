"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectService = exports.deleteStripeAccountService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const payment_model_1 = require("./payment.model");
const stripe_1 = require("../../../config/stripe");
const stripe_adapter_1 = require("./stripe.adapter");
// Create Stripe Connect account for freelancers
const createStripeAccount = async (data) => {
    try {
        const user = await user_model_1.User.findById(data.userId).select('name email phone serviceArea');
        if (!user) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
        const existingAccount = await payment_model_1.StripeAccount.isExistAccountByUserId(data.userId);
        if (existingAccount) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User already has a Stripe account');
        }
        const account = await (0, stripe_adapter_1.createExpressAccount)({
            email: user.email,
            firstName: user.name.split(' ')[0],
            lastName: user.name.split(' ')[1] || '',
            city: undefined,
            metadata: {
                user_id: data.userId.toString(),
                account_type: data.accountType,
            },
        });
        const stripeAccount = new payment_model_1.StripeAccount({
            userId: data.userId,
            stripeAccountId: account.id,
            onboardingCompleted: false,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            country: account.country,
            currency: account.default_currency || 'usd',
            businessType: account.business_type || 'individual',
        });
        await stripeAccount.save();
        return {
            account_id: account.id,
            onboarding_required: !account.charges_enabled,
            database_record: stripeAccount,
        };
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to create Stripe account: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
// Create onboarding link for freelancer
const createOnboardingLink = async (userId) => {
    try {
        const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
        const stripeAccount = await payment_model_1.StripeAccount.isExistAccountByUserId(userObjectId);
        if (!stripeAccount) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Stripe account not found. Please create an account first.');
        }
        if (stripeAccount.onboardingCompleted) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User has already completed onboarding');
        }
        const url = await (0, stripe_adapter_1.createOnboardingLink)(stripeAccount.stripeAccountId, `${process.env.FRONTEND_URL}/onboarding/refresh`, `${process.env.FRONTEND_URL}/onboarding/complete`);
        return url;
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to create onboarding link: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
// Check if freelancer has completed Stripe onboarding
const checkOnboardingStatus = async (userId) => {
    try {
        const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
        const stripeAccount = await payment_model_1.StripeAccount.isExistAccountByUserId(userObjectId);
        if (!stripeAccount) {
            return { completed: false };
        }
        const account = await (0, stripe_adapter_1.retrieveAccount)(stripeAccount.stripeAccountId);
        const completed = account.charges_enabled && account.payouts_enabled;
        const currentlyDue = account?.requirements?.currently_due;
        if (completed !== stripeAccount.onboardingCompleted) {
            await payment_model_1.StripeAccount.updateAccountStatus(stripeAccount.userId, {
                onboardingCompleted: completed,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
            });
        }
        return {
            completed,
            account_id: stripeAccount.stripeAccountId,
            missing_fields: currentlyDue ?? undefined,
        };
    }
    catch (error) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to check onboarding status: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
// Ensure freelancer is onboarded before allowing escrow actions
const ensureFreelancerOnboarded = async (taskerId) => {
    const freelancerStripeAccount = await payment_model_1.StripeAccount.isExistAccountByUserId(taskerId);
    if (!freelancerStripeAccount || !freelancerStripeAccount.onboardingCompleted) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Freelancer has not completed Stripe onboarding');
    }
    return freelancerStripeAccount;
};
// Get freelancer account or throw
const getFreelancerAccountOrThrow = async (userId) => {
    const freelancerStripeAccount = await payment_model_1.StripeAccount.isExistAccountByUserId(userId);
    if (!freelancerStripeAccount?.stripeAccountId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Freelancer Stripe account not found');
    }
    return freelancerStripeAccount;
};
// Delete a Stripe Connect account
const deleteStripeAccountService = async (accountId) => {
    try {
        const deleted = await stripe_1.stripe.accounts.del(accountId);
        if (!deleted.deleted) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to delete account');
        }
        return deleted;
    }
    catch (error) {
        throw (0, stripe_1.handleStripeError)(error);
    }
};
exports.deleteStripeAccountService = deleteStripeAccountService;
// Update local account status from Stripe account.update webhook
const handleAccountUpdated = async (account) => {
    const completed = account.charges_enabled && account.payouts_enabled;
    await payment_model_1.StripeAccount.updateMany({
        stripeAccountId: account.id,
    }, {
        onboardingCompleted: completed,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
    });
};
const StripeConnectService = {
    createStripeAccount,
    createOnboardingLink,
    checkOnboardingStatus,
    ensureFreelancerOnboarded,
    getFreelancerAccountOrThrow,
    deleteStripeAccountService,
    handleAccountUpdated,
};
exports.StripeConnectService = StripeConnectService;
exports.default = StripeConnectService;
//# sourceMappingURL=stripeConnect.service.js.map