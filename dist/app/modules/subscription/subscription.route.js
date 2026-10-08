"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const subscription_controller_1 = __importDefault(require("./subscription.controller"));
const subscription_validation_1 = require("./subscription.validation");
const rateLimit_1 = require("../../middlewares/rateLimit");
const router = express_1.default.Router();
// ----------------------------------------------------
// Web Stripe Subscription Routes
// ----------------------------------------------------
// GET /subscription/me
// নিজের সাবস্ক্রিপশন স্ট্যাটাস/প্ল্যান দেখায় (Stripe থাকলে লাইভ সিঙ্ক)
router.get('/me', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), subscription_controller_1.default.getMySubscriptionController);
// POST /subscription/checkout
// নির্দিষ্ট plan দিয়ে Stripe Checkout session তৈরি করে (redirect URL রিটার্ন)
router.post('/checkout', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 20, routeName: 'subscription-checkout' }), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.createCheckoutSessionSchema), subscription_controller_1.default.createCheckoutSessionController);
// POST /subscription/portal
// Stripe Billing Portal session তৈরি করে (Manage Subscription / Payment Method)
router.post('/portal', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.createPortalSessionSchema), subscription_controller_1.default.createPortalSessionController);
// POST /subscription/choose/free
// লোকালি Free প্ল্যানে সুইচ করে (Stripe সাবস্ক্রিপশন ছাড়াই)
router.post('/choose/free', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), subscription_controller_1.default.chooseFreePlanController);
// ----------------------------------------------------
// Native In-App Purchase (IAP) Routes (Apple & Google)
// Matching backend_subscription_guide.md contract
// ----------------------------------------------------
// POST /subscriptions/verify-apple
// Apple App Store receipt ভেরিফাই করে সাবস্ক্রিপশন একটিভ করে
router.post('/verify-apple', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 30, routeName: 'subscription-verify-apple' }), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.verifyAppleSchema), subscription_controller_1.default.verifyAppleController);
// POST /subscriptions/verify-google
// Google Play purchase token ভেরিফাই ও acknowledge করে সাবস্ক্রিপশন একটিভ করে
router.post('/verify-google', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 30, routeName: 'subscription-verify-google' }), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.verifyGoogleSchema), subscription_controller_1.default.verifyGoogleController);
// POST /subscriptions/restore
// মোবাইল অ্যাপ থেকে Restore Purchases ট্যাপ করলে সাবস্ক্রিপশন রিস্টোর করে
router.post('/restore', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60_000, max: 30, routeName: 'subscription-restore' }), (0, validateRequest_1.default)(subscription_validation_1.SubscriptionValidation.restoreSchema), subscription_controller_1.default.restorePurchasesController);
// GET /subscriptions/status
// অ্যাপ লঞ্চের সময় ইউজারের বর্তমান সাবস্ক্রিপশন স্ট্যাটাস রিটার্ন করে
router.get('/status', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), subscription_controller_1.default.getStatusController);
// POST /subscriptions/apple-webhook
// Apple App Store Server Notifications v2 ইভেন্ট প্রসেস করে
router.post('/apple-webhook', subscription_controller_1.default.appleWebhookController);
// POST /subscriptions/google-webhook
// Google Cloud Pub/Sub Real-Time Developer Notifications (RTDN) ইভেন্ট প্রসেস করে
router.post('/google-webhook', subscription_controller_1.default.googleWebhookController);
exports.SubscriptionRoutes = router;
//# sourceMappingURL=subscription.route.js.map