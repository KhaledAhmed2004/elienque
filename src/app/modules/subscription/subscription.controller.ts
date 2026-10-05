import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import SubscriptionService from './subscription.service';
import IapService from './iap.service';
import { JwtPayload } from 'jsonwebtoken';
import { SUBSCRIPTION_PLAN } from './subscription.interface';

export const getMySubscriptionController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const result = await SubscriptionService.getMySubscription(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription retrieved successfully',
      data: result,
    });
  }
);

export const createCheckoutSessionController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { plan, successUrl, cancelUrl } = req.body as {
      plan: SUBSCRIPTION_PLAN;
      successUrl?: string;
      cancelUrl?: string;
    };
    const result = await SubscriptionService.createCheckoutSession(
      id,
      plan,
      successUrl,
      cancelUrl
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Checkout session created successfully',
      data: result,
    });
  }
);

export const createPortalSessionController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { returnUrl } = req.body as { returnUrl?: string };
    const result = await SubscriptionService.createPortalSession(id, returnUrl);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Billing portal session created successfully',
      data: result,
    });
  }
);

export const chooseFreePlanController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const result = await SubscriptionService.setFreePlan(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Switched to Free plan successfully',
      data: result,
    });
  }
);

// ----------------------------------------------------
// In-App Purchase (IAP) Controllers
// ----------------------------------------------------

export const verifyAppleController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { receipt } = req.body;
    const result = await IapService.verifyAppleReceipt(receipt, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription verified successfully',
      data: result,
    });
  }
);

export const verifyGoogleController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { purchaseToken, productId, orderId } = req.body;
    const result = await IapService.verifyGooglePurchase(
      purchaseToken,
      productId,
      orderId,
      id
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription verified successfully',
      data: result,
    });
  }
);

export const restorePurchasesController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { receipt, purchaseToken } = req.body || {};
    const result = await IapService.restorePurchases(id, receipt, purchaseToken);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: result.isPremium
        ? 'Subscription restored successfully'
        : 'No active subscription found',
      data: result,
    });
  }
);

export const getStatusController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const result = await IapService.getSubscriptionStatus(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Subscription status retrieved successfully',
      data: result,
    });
  }
);

export const appleWebhookController = catchAsync(
  async (req: Request, res: Response) => {
    await IapService.handleAppleWebhook(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Apple notification processed successfully',
    });
  }
);

export const googleWebhookController = catchAsync(
  async (req: Request, res: Response) => {
    await IapService.handleGoogleWebhook(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'Google notification processed successfully',
    });
  }
);

const SubscriptionController = {
  getMySubscriptionController,
  createCheckoutSessionController,
  createPortalSessionController,
  chooseFreePlanController,
  verifyAppleController,
  verifyGoogleController,
  restorePurchasesController,
  getStatusController,
  appleWebhookController,
  googleWebhookController,
};

export default SubscriptionController;