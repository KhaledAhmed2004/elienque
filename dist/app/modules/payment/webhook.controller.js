"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const payment_service_1 = __importDefault(require("./payment.service"));
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = require("../../../config/stripe");
const subscription_model_1 = require("../subscription/subscription.model");
const subscription_interface_1 = require("../subscription/subscription.interface");
class WebhookController {
    // Handle Stripe webhook events
    handleStripeWebhook = async (req, res) => {
        // // Enhanced logging for debugging
        // console.log('🔔 WEBHOOK RECEIVED:', {
        //   timestamp: new Date().toISOString(),
        //   headers: {
        //     'stripe-signature': req.headers['stripe-signature'] ? 'Present' : 'Missing',
        //     'content-type': req.headers['content-type'],
        //     'user-agent': req.headers['user-agent'],
        //   },
        //   bodySize: req.body ? req.body.length : 0,
        //   rawBody: req.body ? req.body.toString().substring(0, 200) + '...' : 'No body'
        // });
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!endpointSecret) {
            console.error('❌ Stripe webhook secret not configured');
            return res.status(http_status_1.default.INTERNAL_SERVER_ERROR).json({
                error: 'Webhook secret not configured',
            });
        }
        res.locals.webhookSecretPreview =
            endpointSecret.substring(0, 10) + '...';
        let event;
        try {
            // Verify webhook signature
            event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
            // console.log('✅ Webhook signature verified successfully');
            // Expose to global logger
            res.locals.webhookSignatureVerified = true;
        }
        catch (err) {
            console.error('❌ Webhook signature verification failed:', {
                error: err.message,
                signature: sig ? sig.substring(0, 20) + '...' : 'No signature',
                bodyLength: req.body ? req.body.length : 0,
            });
            // Expose failure reason to global logger
            res.locals.webhookSignatureVerified = false;
            res.locals.webhookSignatureError =
                err?.message || 'unknown error';
            return res.status(http_status_1.default.BAD_REQUEST).json({
                error: `Webhook Error: ${err.message}`,
            });
        }
        // console.log('📨 Received webhook event:', {
        //   type: event.type,
        //   id: event.id,
        //   created: new Date(event.created * 1000).toISOString(),
        //   livemode: event.livemode,
        // });
        try {
            // Handle the event
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'payment_intent.canceled':
                    await this.handlePaymentCanceled(event.data.object);
                    break;
                case 'payment_intent.amount_capturable_updated':
                    await this.handleAmountCapturableUpdated(event.data.object);
                    break;
                case 'account.updated':
                    await this.handleAccountUpdated(event.data.object);
                    break;
                case 'transfer.created':
                    await this.handleTransferCreated(event.data.object);
                    break;
                case 'transfer.updated':
                    await this.handleTransferUpdated(event.data.object);
                    break;
                case 'payout.created':
                    await this.handlePayoutCreated(event.data.object);
                    break;
                case 'payout.updated':
                    await this.handlePayoutUpdated(event.data.object);
                    break;
                case 'charge.dispute.created':
                    await this.handleDisputeCreated(event.data.object);
                    break;
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
            // Acknowledge receipt of the event
            res.json({ received: true });
        }
        catch (error) {
            console.error(`Error processing webhook event ${event.type}:`, error);
            res.status(http_status_1.default.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to process webhook event',
            });
        }
    };
    // Handle successful payment
    async handlePaymentSucceeded(paymentIntent) {
        try {
            // console.log('💰 Processing payment succeeded:', {
            //   paymentIntentId: paymentIntent.id,
            //   amount: paymentIntent.amount,
            //   currency: paymentIntent.currency,
            //   status: paymentIntent.status,
            //   metadata: paymentIntent.metadata,
            // });
            const bidId = paymentIntent.metadata?.bid_id;
            if (!bidId) {
                console.error('❌ No bid_id found in payment intent metadata:', paymentIntent.metadata);
                return;
            }
            console.log('🎯 Processing payment for bid:', bidId);
            // Use the service method to handle the event
            await payment_service_1.default.handleWebhookEvent({
                type: 'payment_intent.succeeded',
                data: { object: paymentIntent },
            });
            console.log('✅ Successfully processed payment_intent.succeeded for bid:', bidId);
        }
        catch (error) {
            console.error('❌ Error handling payment succeeded:', error);
            throw error;
        }
    }
    // Handle failed payment
    async handlePaymentFailed(paymentIntent) {
        try {
            console.log(`Payment failed: ${paymentIntent.id}`);
            const bidId = paymentIntent.metadata?.bid_id;
            if (!bidId) {
                console.error('No bid_id found in payment intent metadata');
                return;
            }
            // Use the service method to handle the event
            await payment_service_1.default.handleWebhookEvent({
                type: 'payment_intent.payment_failed',
                data: { object: paymentIntent },
            });
            console.log(`Successfully processed payment_intent.payment_failed for bid ${bidId}`);
        }
        catch (error) {
            console.error('Error handling payment failed:', error);
            throw error;
        }
    }
    // Handle canceled payment
    async handlePaymentCanceled(paymentIntent) {
        try {
            console.log(`Payment canceled: ${paymentIntent.id}`);
            const bidId = paymentIntent.metadata?.bid_id;
            if (!bidId) {
                console.error('No bid_id found in payment intent metadata');
                return;
            }
            // Treat canceled payments similar to failed payments
            await payment_service_1.default.handleWebhookEvent({
                type: 'payment_intent.payment_failed',
                data: { object: paymentIntent },
            });
            console.log(`Successfully processed payment_intent.canceled for bid ${bidId}`);
        }
        catch (error) {
            console.error('Error handling payment canceled:', error);
            throw error;
        }
    }
    // Handle amount capturable updated (manual capture flow)
    async handleAmountCapturableUpdated(paymentIntent) {
        try {
            // console.log('💳 Amount capturable updated:', {
            //   paymentIntentId: paymentIntent.id,
            //   amount_capturable: paymentIntent.amount_capturable,
            //   currency: paymentIntent.currency,
            //   status: paymentIntent.status,
            //   metadata: paymentIntent.metadata,
            // });
            const bidId = paymentIntent.metadata?.bid_id;
            if (!bidId) {
                console.error('❌ No bid_id found in payment intent metadata:', paymentIntent.metadata);
                return;
            }
            // console.log('🎯 Triggering capture for bid:', bidId);
            // Delegate to service to perform capture + updates
            await payment_service_1.default.handleWebhookEvent({
                type: 'payment_intent.amount_capturable_updated',
                data: { object: paymentIntent },
            });
            // console.log(
            //   '✅ Successfully processed amount_capturable_updated for bid:',
            //   bidId
            // );
        }
        catch (error) {
            console.error('❌ Error handling amount capturable updated:', error);
            throw error;
        }
    }
    // Handle Stripe Connect account updates
    async handleAccountUpdated(account) {
        try {
            console.log(`Account updated: ${account.id}`);
            // Use the service method to handle the event
            await payment_service_1.default.handleWebhookEvent({
                type: 'account.updated',
                data: { object: account },
            });
            console.log(`Successfully processed account.updated for account ${account.id}`);
        }
        catch (error) {
            console.error('Error handling account updated:', error);
            throw error;
        }
    }
    // Handle transfer creation (money moved to freelancer)
    async handleTransferCreated(transfer) {
        try {
            console.log(`Transfer created: ${transfer.id} to ${transfer.destination}`);
            // Log transfer details for monitoring
            console.log({
                transfer_id: transfer.id,
                amount: transfer.amount,
                currency: transfer.currency,
                destination: transfer.destination,
                created: transfer.created,
            });
        }
        catch (error) {
            console.error('Error handling transfer created:', error);
            throw error;
        }
    }
    // Handle transfer updates
    async handleTransferUpdated(transfer) {
        try {
            console.log(`Transfer updated: ${transfer.id} - Status: ${transfer.status}`);
            // Log transfer status changes
            if (transfer.status === 'failed') {
                console.error(`Transfer failed: ${transfer.id}`, transfer.failure_message);
                // TODO: Implement failure handling - notify users, update payment status
            }
        }
        catch (error) {
            console.error('Error handling transfer updated:', error);
            throw error;
        }
    }
    // Handle payout creation (money moved from Stripe to bank account)
    async handlePayoutCreated(payout) {
        try {
            console.log(`Payout created: ${payout.id}`);
            // Log payout details for monitoring
            console.log({
                payout_id: payout.id,
                amount: payout.amount,
                currency: payout.currency,
                status: payout.status,
                arrival_date: payout.arrival_date,
            });
        }
        catch (error) {
            console.error('Error handling payout created:', error);
            throw error;
        }
    }
    // Handle payout updates
    async handlePayoutUpdated(payout) {
        try {
            console.log(`Payout updated: ${payout.id} - Status: ${payout.status}`);
            // Log payout status changes
            if (payout.status === 'failed') {
                console.error(`Payout failed: ${payout.id}`, payout.failure_message);
                // TODO: Implement failure handling - notify freelancer
            }
            else if (payout.status === 'paid') {
                console.log(`Payout completed: ${payout.id}`);
                // TODO: Implement success handling - notify freelancer
            }
        }
        catch (error) {
            console.error('Error handling payout updated:', error);
            throw error;
        }
    }
    // Handle dispute creation (chargeback)
    async handleDisputeCreated(dispute) {
        try {
            console.log(`Dispute created: ${dispute.id} for charge: ${dispute.charge}`);
            // Log dispute details
            console.log({
                dispute_id: dispute.id,
                charge_id: dispute.charge,
                amount: dispute.amount,
                currency: dispute.currency,
                reason: dispute.reason,
                status: dispute.status,
            });
            // TODO: Implement dispute handling
            // - Notify admin/support team
            // - Update payment status
            // - Freeze related funds if necessary
            // - Send notification to affected users
            console.warn('DISPUTE ALERT: Manual review required for dispute', dispute.id);
        }
        catch (error) {
            console.error('Error handling dispute created:', error);
            throw error;
        }
    }
    // Handle Stripe Checkout session completed (subscription payment)
    async handleCheckoutSessionCompleted(session) {
        try {
            if (session.mode !== 'subscription')
                return;
            const userId = session.metadata?.userId;
            const plan = session.metadata?.plan;
            if (!userId) {
                console.error('No userId in checkout session metadata:', session.metadata);
                return;
            }
            const stripeSubscriptionId = session.subscription;
            let currentPeriodEnd = null;
            if (stripeSubscriptionId) {
                const stripeSub = await stripe_1.stripe.subscriptions.retrieve(stripeSubscriptionId);
                const periodEnd = stripeSub.items?.data?.[0]?.current_period_end
                    || stripeSub.current_period_end;
                if (periodEnd) {
                    currentPeriodEnd = new Date(periodEnd * 1000);
                }
            }
            await subscription_model_1.Subscription.upsertForUser(new mongoose_1.Types.ObjectId(userId), {
                plan: plan || subscription_interface_1.SUBSCRIPTION_PLAN.YEARLY,
                status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
                stripeSubscriptionId,
                currentPeriodEnd,
            });
            console.log(`Subscription activated for user ${userId}, plan: ${plan || 'YEARLY'}`);
        }
        catch (error) {
            console.error('Error handling checkout.session.completed:', error);
            throw error;
        }
    }
    // Handle Stripe subscription updated (status/period sync)
    async handleSubscriptionUpdated(subscription) {
        try {
            const stripeSubId = subscription.id;
            const existingSub = await subscription_model_1.Subscription.findOne({ stripeSubscriptionId: stripeSubId });
            if (!existingSub)
                return;
            const statusMap = {
                active: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
                trialing: subscription_interface_1.SUBSCRIPTION_STATUS.TRIALING,
                past_due: subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE,
                canceled: subscription_interface_1.SUBSCRIPTION_STATUS.CANCELED,
                unpaid: subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE,
            };
            const normalizedStatus = statusMap[subscription.status] || subscription_interface_1.SUBSCRIPTION_STATUS.INACTIVE;
            const currentPeriodEnd = subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null;
            await subscription_model_1.Subscription.upsertForUser(existingSub.userId, {
                status: normalizedStatus,
                currentPeriodEnd,
            });
            console.log(`Subscription updated for user ${existingSub.userId}: ${normalizedStatus}`);
        }
        catch (error) {
            console.error('Error handling customer.subscription.updated:', error);
            throw error;
        }
    }
    // Handle Stripe subscription deleted (canceled)
    async handleSubscriptionDeleted(subscription) {
        try {
            const stripeSubId = subscription.id;
            const existingSub = await subscription_model_1.Subscription.findOne({ stripeSubscriptionId: stripeSubId });
            if (!existingSub)
                return;
            await subscription_model_1.Subscription.upsertForUser(existingSub.userId, {
                status: subscription_interface_1.SUBSCRIPTION_STATUS.CANCELED,
            });
            console.log(`Subscription canceled for user ${existingSub.userId}`);
        }
        catch (error) {
            console.error('Error handling customer.subscription.deleted:', error);
            throw error;
        }
    }
    // Health check endpoint for webhook
    webhookHealthCheck = (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            webhook_endpoint: '/api/payment/webhook',
        });
    };
}
exports.default = new WebhookController();
//# sourceMappingURL=webhook.controller.js.map