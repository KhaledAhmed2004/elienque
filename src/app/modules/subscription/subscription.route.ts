import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import SubscriptionController from './subscription.controller';
import { SubscriptionValidation } from './subscription.validation';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';

const router = express.Router();

// ----------------------------------------------------
// Web Stripe Subscription Routes
// ----------------------------------------------------

// GET /subscription/me
// নিজের সাবস্ক্রিপশন স্ট্যাটাস/প্ল্যান দেখায় (Stripe থাকলে লাইভ সিঙ্ক)
router.get(
  '/me',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  SubscriptionController.getMySubscriptionController
);

// POST /subscription/checkout
// নির্দিষ্ট plan দিয়ে Stripe Checkout session তৈরি করে (redirect URL রিটার্ন)
router.post(
  '/checkout',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  rateLimitMiddleware({ windowMs: 60_000, max: 20, routeName: 'subscription-checkout' }),
  validateRequest(SubscriptionValidation.createCheckoutSessionSchema),
  SubscriptionController.createCheckoutSessionController
);

// POST /subscription/portal
// Stripe Billing Portal session তৈরি করে (Manage Subscription / Payment Method)
router.post(
  '/portal',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  validateRequest(SubscriptionValidation.createPortalSessionSchema),
  SubscriptionController.createPortalSessionController
);

// POST /subscription/choose/free
// লোকালি Free প্ল্যানে সুইচ করে (Stripe সাবস্ক্রিপশন ছাড়াই)
router.post(
  '/choose/free',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  SubscriptionController.chooseFreePlanController
);

// ----------------------------------------------------
// Native In-App Purchase (IAP) Routes (Apple & Google)
// Matching backend_subscription_guide.md contract
// ----------------------------------------------------

// POST /subscriptions/verify-apple
// Apple App Store receipt ভেরিফাই করে সাবস্ক্রিপশন একটিভ করে
router.post(
  '/verify-apple',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  rateLimitMiddleware({ windowMs: 60_000, max: 30, routeName: 'subscription-verify-apple' }),
  validateRequest(SubscriptionValidation.verifyAppleSchema),
  SubscriptionController.verifyAppleController
);

// POST /subscriptions/verify-google
// Google Play purchase token ভেরিফাই ও acknowledge করে সাবস্ক্রিপশন একটিভ করে
router.post(
  '/verify-google',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  rateLimitMiddleware({ windowMs: 60_000, max: 30, routeName: 'subscription-verify-google' }),
  validateRequest(SubscriptionValidation.verifyGoogleSchema),
  SubscriptionController.verifyGoogleController
);

// POST /subscriptions/restore
// মোবাইল অ্যাপ থেকে Restore Purchases ট্যাপ করলে সাবস্ক্রিপশন রিস্টোর করে
router.post(
  '/restore',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  rateLimitMiddleware({ windowMs: 60_000, max: 30, routeName: 'subscription-restore' }),
  validateRequest(SubscriptionValidation.restoreSchema),
  SubscriptionController.restorePurchasesController
);

// GET /subscriptions/status
// অ্যাপ লঞ্চের সময় ইউজারের বর্তমান সাবস্ক্রিপশন স্ট্যাটাস রিটার্ন করে
router.get(
  '/status',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  SubscriptionController.getStatusController
);

// POST /subscriptions/apple-webhook
// Apple App Store Server Notifications v2 ইভেন্ট প্রসেস করে
router.post(
  '/apple-webhook',
  SubscriptionController.appleWebhookController
);

// POST /subscriptions/google-webhook
// Google Cloud Pub/Sub Real-Time Developer Notifications (RTDN) ইভেন্ট প্রসেস করে
router.post(
  '/google-webhook',
  SubscriptionController.googleWebhookController
);

export const SubscriptionRoutes = router;
