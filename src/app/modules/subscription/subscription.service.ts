import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { stripe, handleStripeError } from '../../../config/stripe';
import config from '../../../config';
import { Subscription as SubscriptionModel } from './subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from './subscription.interface';
import { User } from '../user/user.model';

const PRICE_IDS: Record<SUBSCRIPTION_PLAN, string | null> = {
  [SUBSCRIPTION_PLAN.FREE]: null,
  [SUBSCRIPTION_PLAN.YEARLY]: process.env.STRIPE_PRICE_YEARLY || null,
};

const ensureSubscriptionDoc = async (userId: string): Promise<ISubscription> => {
  const id = new Types.ObjectId(userId);
  const doc = await SubscriptionModel.findByUser(id);
  if (doc) return doc;
  return await SubscriptionModel.upsertForUser(id, {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });
};

const ensureStripeCustomerForUser = async (userId: string): Promise<string> => {
  const sub = await ensureSubscriptionDoc(userId);
  if (sub.stripeCustomerId) return sub.stripeCustomerId;

  const user = await User.findById(userId).select('+email name').lean();
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  try {
    const customer = await stripe.customers.create({
      email: (user as any).email,
      name: (user as any).name,
      metadata: { userId },
    });
    const updated = await SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
      stripeCustomerId: customer.id,
    });
    return updated.stripeCustomerId!;
  } catch (error) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to create Stripe customer: ${handleStripeError(error)}`
    );
  }
};

export const getMySubscription = async (userId: string): Promise<ISubscription> => {
  const sub = await ensureSubscriptionDoc(userId);

  // If we have a Stripe subscription, fetch latest status
  if (sub.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const statusMap: Record<string, SUBSCRIPTION_STATUS> = {
        active: SUBSCRIPTION_STATUS.ACTIVE,
        trialing: SUBSCRIPTION_STATUS.TRIALING,
        past_due: SUBSCRIPTION_STATUS.PAST_DUE,
        canceled: SUBSCRIPTION_STATUS.CANCELED,
        unpaid: SUBSCRIPTION_STATUS.PAST_DUE,
      };
      const periodEnd = (stripeSub as any).items?.data?.[0]?.current_period_end
        || (stripeSub as any).current_period_end;
      const currentPeriodEnd = periodEnd
        ? new Date(periodEnd * 1000)
        : null;
      const normalizedStatus = statusMap[(stripeSub as any).status] || SUBSCRIPTION_STATUS.INACTIVE;
      const updated = await SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
        status: normalizedStatus,
        currentPeriodEnd,
      });
      return updated;
    } catch (e) {
      // If Stripe fetch fails, return existing doc without hard failure
      return sub;
    }
  }
  // If we don't have a subscription ID but have a customer, try to discover one
  if (sub.stripeCustomerId) {
    try {
      const list = await stripe.subscriptions.list({ customer: sub.stripeCustomerId, status: 'all', limit: 1 });
      if (list.data && list.data.length > 0) {
        const found = list.data[0];
        const statusMap: Record<string, SUBSCRIPTION_STATUS> = {
          active: SUBSCRIPTION_STATUS.ACTIVE,
          trialing: SUBSCRIPTION_STATUS.TRIALING,
          past_due: SUBSCRIPTION_STATUS.PAST_DUE,
          canceled: SUBSCRIPTION_STATUS.CANCELED,
          unpaid: SUBSCRIPTION_STATUS.PAST_DUE,
        };
        const foundPeriodEnd = (found as any).items?.data?.[0]?.current_period_end
          || (found as any).current_period_end;
        const currentPeriodEnd = foundPeriodEnd ? new Date(foundPeriodEnd * 1000) : null;
        const normalizedStatus = statusMap[(found as any).status] || SUBSCRIPTION_STATUS.INACTIVE;
        const updated = await SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
          stripeSubscriptionId: found.id,
          status: normalizedStatus,
          currentPeriodEnd,
        });
        return updated;
      }
    } catch {
      // ignore discovery errors
    }
  }
  return sub;
};

export const createCheckoutSession = async (
  userId: string,
  plan: SUBSCRIPTION_PLAN,
  successUrl?: string,
  cancelUrl?: string
): Promise<{ url: string }> => {
  if (plan === SUBSCRIPTION_PLAN.FREE) {
    // Directly switch to free locally
    await SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
      plan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      stripeSubscriptionId: undefined,
    });
    return { url: `${config.frontend_url || 'http://localhost:5173'}/billing` };
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Price ID missing for plan ${plan}. Set env STRIPE_PRICE_${plan}`
    );
  }

  const customerId = await ensureStripeCustomerForUser(userId);
  const success = successUrl || `${config.frontend_url || 'http://localhost:5173'}/billing/success`;
  const cancel = cancelUrl || `${config.frontend_url || 'http://localhost:5173'}/billing/cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      metadata: { userId, plan },
    });
    return { url: session.url! };
  } catch (error) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to create checkout session: ${handleStripeError(error)}`
    );
  }
};

export const createPortalSession = async (
  userId: string,
  returnUrl?: string
): Promise<{ url: string }> => {
  const customerId = await ensureStripeCustomerForUser(userId);
  const return_url = returnUrl || `${config.frontend_url || 'http://localhost:5173'}/billing`;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });
    return { url: session.url };
  } catch (error) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to create billing portal session: ${handleStripeError(error)}`
    );
  }
};

export const setFreePlan = async (userId: string): Promise<ISubscription> => {
  return SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    stripeSubscriptionId: undefined,
  });
};

export const attachStripeSubscriptionToUser = async (
  userId: string,
  stripeSubscriptionId: string,
  plan: SUBSCRIPTION_PLAN
): Promise<void> => {
  await SubscriptionModel.upsertForUser(new Types.ObjectId(userId), {
    stripeSubscriptionId,
    plan,
  });
};

const SubscriptionService = {
  getMySubscription,
  createCheckoutSession,
  createPortalSession,
  setFreePlan,
  attachStripeSubscriptionToUser,
};

export default SubscriptionService;