"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleWebhookController = exports.appleWebhookController = exports.getStatusController = exports.restorePurchasesController = exports.verifyGoogleController = exports.verifyAppleController = exports.chooseFreePlanController = exports.createPortalSessionController = exports.createCheckoutSessionController = exports.getMySubscriptionController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const subscription_service_1 = __importDefault(require("./subscription.service"));
const iap_service_1 = __importDefault(require("./iap.service"));
exports.getMySubscriptionController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const result = await subscription_service_1.default.getMySubscription(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Subscription retrieved successfully',
        data: result,
    });
});
exports.createCheckoutSessionController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const { plan, successUrl, cancelUrl } = req.body;
    const result = await subscription_service_1.default.createCheckoutSession(id, plan, successUrl, cancelUrl);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Checkout session created successfully',
        data: result,
    });
});
exports.createPortalSessionController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const { returnUrl } = req.body;
    const result = await subscription_service_1.default.createPortalSession(id, returnUrl);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Billing portal session created successfully',
        data: result,
    });
});
exports.chooseFreePlanController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const result = await subscription_service_1.default.setFreePlan(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Switched to Free plan successfully',
        data: result,
    });
});
// ----------------------------------------------------
// In-App Purchase (IAP) Controllers
// ----------------------------------------------------
exports.verifyAppleController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const { receipt } = req.body;
    const result = await iap_service_1.default.verifyAppleReceipt(receipt, id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Subscription verified successfully',
        data: result,
    });
});
exports.verifyGoogleController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const { purchaseToken, productId, orderId } = req.body;
    const result = await iap_service_1.default.verifyGooglePurchase(purchaseToken, productId, orderId, id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Subscription verified successfully',
        data: result,
    });
});
exports.restorePurchasesController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const { receipt, purchaseToken } = req.body || {};
    const result = await iap_service_1.default.restorePurchases(id, receipt, purchaseToken);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: result.isPremium
            ? 'Subscription restored successfully'
            : 'No active subscription found',
        data: result,
    });
});
exports.getStatusController = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.user;
    const result = await iap_service_1.default.getSubscriptionStatus(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Subscription status retrieved successfully',
        data: result,
    });
});
exports.appleWebhookController = (0, catchAsync_1.default)(async (req, res) => {
    await iap_service_1.default.handleAppleWebhook(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Apple notification processed successfully',
    });
});
exports.googleWebhookController = (0, catchAsync_1.default)(async (req, res) => {
    await iap_service_1.default.handleGoogleWebhook(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_1.default.OK,
        message: 'Google notification processed successfully',
    });
});
const SubscriptionController = {
    getMySubscriptionController: exports.getMySubscriptionController,
    createCheckoutSessionController: exports.createCheckoutSessionController,
    createPortalSessionController: exports.createPortalSessionController,
    chooseFreePlanController: exports.chooseFreePlanController,
    verifyAppleController: exports.verifyAppleController,
    verifyGoogleController: exports.verifyGoogleController,
    restorePurchasesController: exports.restorePurchasesController,
    getStatusController: exports.getStatusController,
    appleWebhookController: exports.appleWebhookController,
    googleWebhookController: exports.googleWebhookController,
};
exports.default = SubscriptionController;
//# sourceMappingURL=subscription.controller.js.map