"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const payment_controller_1 = __importDefault(require("./payment.controller"));
const webhook_controller_1 = __importDefault(require("./webhook.controller"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const stripeConnect_controller_1 = require("./stripeConnect.controller");
const router = express_1.default.Router();
// Webhook route (no authentication required)
// Note: raw body parsing for webhook is set at app level
router.post('/webhook', webhook_controller_1.default.handleStripeWebhook);
// Create/manage Stripe Connect account
router.post('/stripe/account', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), stripeConnect_controller_1.StripeConnectController.createStripeAccountController);
// Stripe onboarding link — visible to tasker/admin
router.get('/stripe/onboarding', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), stripeConnect_controller_1.StripeConnectController.getOnboardingLinkController);
// Check Stripe onboarding status — all roles
router.get('/stripe/onboarding-status', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), stripeConnect_controller_1.StripeConnectController.checkOnboardingStatusController);
// Payment history — poster/tasker/super admin
router.get('/history', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), payment_controller_1.default.getPaymentHistoryController);
// Get current PaymentIntent + client_secret by bidId
router.get('/by-bid/:bidId/current-intent', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), payment_controller_1.default.getCurrentIntentByBidController);
// Refund payment — poster/super admin
router.post('/refund/:paymentId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), payment_controller_1.default.refundPaymentController);
// Specific payment details — role-based access
router.get('/:paymentId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER), payment_controller_1.default.getPaymentByIdController);
// All payments list — super admin
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), payment_controller_1.default.getPaymentsController);
// Payment stats — super admin
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), payment_controller_1.default.getPaymentStatsController);
// Delete Stripe account — super admin
router.delete('/account/:accountId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), payment_controller_1.default.deleteStripeAccountController);
exports.PaymentRoutes = router;
//# sourceMappingURL=payment.routes.js.map