import express from 'express';
import PaymentController from './payment.controller';
import WebhookController from './webhook.controller';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { StripeConnectController } from './stripeConnect.controller';

const router = express.Router();

// Webhook route (no authentication required)
// Note: raw body parsing for webhook is set at app level
router.post(
  '/webhook',
  WebhookController.handleStripeWebhook
);

// Create/manage Stripe Connect account
router.post(
  '/stripe/account',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  StripeConnectController.createStripeAccountController
);

// Stripe onboarding link — visible to tasker/admin
router.get(
  '/stripe/onboarding',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  StripeConnectController.getOnboardingLinkController
);

// Check Stripe onboarding status — all roles
router.get(
  '/stripe/onboarding-status',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  StripeConnectController.checkOnboardingStatusController
);

// Payment history — poster/tasker/super admin
router.get(
  '/history',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  PaymentController.getPaymentHistoryController
);

// Get current PaymentIntent + client_secret by bidId
router.get(
  '/by-bid/:bidId/current-intent',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  PaymentController.getCurrentIntentByBidController
);

// Refund payment — poster/super admin
router.post(
  '/refund/:paymentId',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  PaymentController.refundPaymentController
);

// Specific payment details — role-based access
router.get(
  '/:paymentId',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER),
  PaymentController.getPaymentByIdController
);

// All payments list — super admin
router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  PaymentController.getPaymentsController
);

// Payment stats — super admin
router.get(
  '/stats',
  auth(USER_ROLES.ADMIN),
  PaymentController.getPaymentStatsController
);

// Delete Stripe account — super admin
router.delete(
  '/account/:accountId',
  auth(USER_ROLES.ADMIN),
  PaymentController.deleteStripeAccountController
);



export const PaymentRoutes = router;
