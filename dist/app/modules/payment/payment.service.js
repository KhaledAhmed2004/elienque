"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentIntentByBid = exports.getUserPaymentStats = exports.getUserPayments = exports.handleWebhookEvent = exports.getPaymentStatsOverview = exports.getPayments = exports.getPaymentById = exports.refundEscrowPayment = exports.releaseEscrowPayment = exports.createEscrowPayment = void 0;
const payment_interface_1 = require("./payment.interface");
const mongoose_1 = __importDefault(require("mongoose"));
const payment_model_1 = require("./payment.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const analytics_1 = require("../../../helpers/analytics");
const stripe_1 = require("../../../config/stripe");
const stripe_adapter_1 = require("./stripe.adapter");
const notification_1 = require("../../../helpers/notification");
const logger_1 = require("../../../shared/logger");
const stripeConnect_service_1 = __importDefault(require("./stripeConnect.service"));
// Lazy-load optional modules (bid/task may not exist in all template variants)
const getBidModel = () => {
    try {
        return require('../bid/bid.model').BidModel;
    }
    catch {
        return null;
    }
};
const getTaskModel = () => {
    try {
        return require('../task/task.model').TaskModel;
    }
    catch {
        return null;
    }
};
const getTaskStatus = () => {
    try {
        return require('../task/task.model').TaskStatus;
    }
    catch {
        return { OPEN: 'open' };
    }
};
const BidModel = getBidModel();
const TaskModel = getTaskModel();
const TaskStatus = getTaskStatus();
// Helper to present sender/receiver aliases for readability
const mapPaymentToView = (payment) => {
    const base = typeof payment?.toObject === 'function' ? payment.toObject() : payment;
    return {
        ...base,
        senderId: base.posterId,
        receiverId: base.freelancerId,
    };
};
// Moved to stripeConnected.service.ts
// Moved to stripeConnected.service.ts
// Moved to stripeConnected.service.ts
// Create escrow payment when bid is accepted
// Escrow helpers (internal)
const getBidAndTask = async (bidId) => {
    const bid = await BidModel.findById(bidId).populate('taskId');
    if (!bid) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Bid not found');
    }
    const task = bid.taskId;
    if (!bid.taskerId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Bid does not have an assigned freelancer');
    }
    return { bid, task };
};
// Moved to stripeConnected.service.ts
const ensureNoExistingPaymentForBid = async (bidId) => {
    const existingPayment = await payment_model_1.Payment.getPaymentsByBid(bidId);
    if (existingPayment && existingPayment.length > 0) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Payment already exists for this bid');
    }
};
const buildIntentMetadata = (data, task) => ({
    bid_id: data.bidId.toString(),
    poster_id: data.posterId.toString(),
    freelancer_id: data.freelancerId.toString(),
    task_title: task?.title,
    type: 'escrow_payment',
});
const createEscrowIntent = async (amount, metadata) => {
    return (0, stripe_adapter_1.createPaymentIntent)({
        amountDollars: amount,
        currency: stripe_1.DEFAULT_CURRENCY,
        captureMethod: 'manual',
        metadata,
    });
};
const createPaymentRecord = async (data, platformFee, freelancerAmount, paymentIntentId) => {
    const payment = new payment_model_1.Payment({
        taskId: data.taskId,
        bidId: data.bidId,
        posterId: data.posterId,
        freelancerId: data.freelancerId,
        amount: data.amount,
        platformFee,
        freelancerAmount,
        stripePaymentIntentId: paymentIntentId,
        status: payment_interface_1.PAYMENT_STATUS.PENDING,
        currency: stripe_1.DEFAULT_CURRENCY,
        metadata: data.metadata,
    });
    await payment.save();
    return payment;
};
const createEscrowPayment = async (data) => {
    try {
        // Validate required fields early
        if (!data.bidId) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Bid ID is required for escrow payment');
        }
        if (!data.posterId) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Poster ID is required for escrow payment');
        }
        const { bid, task } = await getBidAndTask(data.bidId);
        await stripeConnect_service_1.default.ensureFreelancerOnboarded(bid.taskerId);
        await ensureNoExistingPaymentForBid(data.bidId);
        const platformFee = (0, stripe_1.calculatePlatformFee)(data.amount);
        const freelancerAmount = (0, stripe_1.calculateFreelancerAmount)(data.amount);
        const metadata = buildIntentMetadata(data, task);
        const paymentIntent = await createEscrowIntent(data.amount, metadata);
        const payment = await createPaymentRecord(data, platformFee, freelancerAmount, paymentIntent.id);
        return {
            payment,
            client_secret: paymentIntent.client_secret,
        };
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to create escrow payment: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.createEscrowPayment = createEscrowPayment;
// Release payment when task is completed and approved
// Release helpers (internal)
const getPaymentOrThrow = async (paymentId) => {
    const payment = await payment_model_1.Payment.isExistPaymentById(paymentId.toString());
    if (!payment) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Payment not found');
    }
    return payment;
};
const ensureHeldStatus = (payment) => {
    if (payment.status !== payment_interface_1.PAYMENT_STATUS.HELD) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Payment is not in held status. Current status: ${payment.status}`);
    }
};
const ensureClientAuthorized = async (taskId, clientId) => {
    const task = await TaskModel.findById(taskId);
    if (!task || task.userId.toString() !== clientId?.toString()) {
        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'You are not authorized to release this payment');
    }
};
const getChargeIdForIntent = async (intentId) => {
    const paymentIntent = await stripe_1.stripe.paymentIntents.retrieve(intentId, {
        expand: ['latest_charge'],
    });
    let chargeId;
    const latestCharge = paymentIntent.latest_charge;
    if (typeof latestCharge === 'string') {
        chargeId = latestCharge;
    }
    else if (latestCharge && latestCharge.id) {
        chargeId = latestCharge.id;
    }
    if (!chargeId) {
        const chargeList = await stripe_1.stripe.charges.list({
            payment_intent: intentId,
            limit: 1,
        });
        if (chargeList.data && chargeList.data.length > 0) {
            chargeId = chargeList.data[0].id;
        }
    }
    return { chargeId, canTransferWithoutSource: !chargeId };
};
// Moved to stripeConnected.service.ts
const createTransferToFreelancer = async (amount, currency, destination, sourceChargeId, metadata) => {
    return (0, stripe_adapter_1.createTransfer)({
        amountDollars: amount,
        currency,
        destinationAccountId: destination,
        sourceChargeId,
        metadata,
    });
};
const markPaymentReleasedAndBidCompleted = async (paymentId, bidId) => {
    await payment_model_1.Payment.updatePaymentStatus(paymentId, payment_interface_1.PAYMENT_STATUS.RELEASED);
    await BidModel.findByIdAndUpdate(bidId, { status: 'completed' });
};
const releaseEscrowPayment = async (data) => {
    try {
        const payment = await getPaymentOrThrow(data.paymentId);
        ensureHeldStatus(payment);
        await ensureClientAuthorized(payment.taskId, data.clientId);
        const { chargeId } = await getChargeIdForIntent(payment.stripePaymentIntentId);
        const freelancerStripeAccount = await stripeConnect_service_1.default.getFreelancerAccountOrThrow(payment.freelancerId);
        await createTransferToFreelancer(payment.freelancerAmount, payment.currency || stripe_1.DEFAULT_CURRENCY, freelancerStripeAccount.stripeAccountId, chargeId, {
            bid_id: payment.bidId?.toString?.() || String(payment.bidId),
            payment_id: payment._id?.toString?.() || String(payment._id),
            intent_id: payment.stripePaymentIntentId,
            type: 'escrow_release_transfer',
        });
        await markPaymentReleasedAndBidCompleted(data.paymentId, payment.bidId);
        return {
            success: true,
            message: 'Payment released and transferred to freelancer successfully',
            freelancer_amount: payment.freelancerAmount,
            platform_fee: payment.platformFee,
        };
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to release payment: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.releaseEscrowPayment = releaseEscrowPayment;
// Refund escrow payment
// Refund helpers (internal)
const ensureRefundable = (payment) => {
    if (payment.status === payment_interface_1.PAYMENT_STATUS.REFUNDED) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Payment has already been refunded');
    }
    if (payment.status === payment_interface_1.PAYMENT_STATUS.RELEASED) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot refund a payment that has already been released');
    }
};
const createRefundForIntent = async (intentId, reason) => {
    return (0, stripe_adapter_1.createRefundForIntent)(intentId, reason);
};
const markPaymentRefunded = async (paymentId, reason) => {
    await payment_model_1.Payment.updatePaymentStatus(new mongoose_1.default.Types.ObjectId(paymentId), payment_interface_1.PAYMENT_STATUS.REFUNDED);
    if (reason) {
        await payment_model_1.Payment.findByIdAndUpdate(paymentId, {
            refundReason: reason,
        });
    }
};
const refundEscrowPayment = async (paymentId, reason) => {
    try {
        const payment = await payment_model_1.Payment.isExistPaymentById(paymentId);
        if (!payment) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Payment not found');
        }
        ensureRefundable(payment);
        const refund = await createRefundForIntent(payment.stripePaymentIntentId, reason);
        await markPaymentRefunded(paymentId, reason);
        await BidModel.findByIdAndUpdate(payment.bidId, {
            status: 'cancelled',
        });
        return {
            success: true,
            message: 'Payment refunded successfully',
            refund_id: refund.id,
            amount_refunded: refund.amount / 100,
        };
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to refund payment: ${(0, stripe_1.handleStripeError)(error)}`);
    }
};
exports.refundEscrowPayment = refundEscrowPayment;
// Get payment by ID
const getPaymentById = async (paymentId) => {
    try {
        const payment = await payment_model_1.Payment.isExistPaymentById(paymentId);
        return payment ? mapPaymentToView(payment) : null;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to get payment: ${errorMessage}`);
    }
};
exports.getPaymentById = getPaymentById;
// Get payments with filters and pagination
const getPayments = async (filters, page = 1, limit = 10) => {
    try {
        // Validate and normalize pagination
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        if (pageNum < 1) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Page must be greater than 0');
        }
        if (limitNum < 1 || limitNum > 100) {
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Limit must be between 1 and 100');
        }
        // Build query object compatible with PaymentModel fields
        const queryObj = {};
        if (filters.status)
            queryObj.status = filters.status;
        if (filters.clientId)
            queryObj.posterId = filters.clientId;
        if (filters.freelancerId)
            queryObj.freelancerId = filters.freelancerId;
        if (filters.bidId)
            queryObj.bidId = filters.bidId;
        if (filters.dateFrom || filters.dateTo) {
            const createdAt = {};
            if (filters.dateFrom)
                createdAt.$gte = filters.dateFrom;
            if (filters.dateTo)
                createdAt.$lte = filters.dateTo;
            queryObj.createdAt = createdAt;
        }
        // Use QueryBuilder for filter/sort/pagination
        const qb = new QueryBuilder_1.default(payment_model_1.Payment.find(), {
            ...queryObj,
            page: pageNum,
            limit: limitNum,
        })
            .filter()
            .sort() // default '-createdAt'
            .paginate();
        // Deep populate bid -> task and tasker
        qb.modelQuery = qb.modelQuery.populate({
            path: 'bidId',
            populate: [
                { path: 'taskId', select: 'title' },
                { path: 'taskerId', select: 'name email' },
            ],
        });
        const payments = await qb.modelQuery;
        const pageInfo = await qb.getPaginationInfo();
        return {
            payments: payments.map(mapPaymentToView),
            total: pageInfo.total,
            totalPages: pageInfo.totalPage,
            currentPage: pageInfo.page,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to get payments: ${errorMessage}`);
    }
};
exports.getPayments = getPayments;
// Payment stats overview (growth metrics similar to Task stats)
const getPaymentStatsOverview = async () => {
    const builder = new analytics_1.AnalyticsHelper(payment_model_1.Payment);
    const allPayments = await builder.calculateGrowth({ period: 'month' });
    const released = await builder.calculateGrowth({
        filter: { status: payment_interface_1.PAYMENT_STATUS.RELEASED },
        period: 'month',
    });
    const pending = await builder.calculateGrowth({
        filter: { status: payment_interface_1.PAYMENT_STATUS.PENDING },
        period: 'month',
    });
    const refunded = await builder.calculateGrowth({
        filter: { status: payment_interface_1.PAYMENT_STATUS.REFUNDED },
        period: 'month',
    });
    return {
        allPayments,
        released,
        pending,
        refunded,
    };
};
exports.getPaymentStatsOverview = getPaymentStatsOverview;
// Handle Stripe webhook events
const handleWebhookEvent = async (event) => {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event.data.object);
            break;
        case 'payment_intent.payment_failed':
            await handlePaymentFailed(event.data.object);
            break;
        case 'account.updated':
            await stripeConnect_service_1.default.handleAccountUpdated(event.data.object);
            break;
        case 'payment_intent.amount_capturable_updated':
            await handleAmountCapturableUpdated(event.data.object);
            break;
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
};
exports.handleWebhookEvent = handleWebhookEvent;
// Handle payment succeeded webhook
const handlePaymentSucceeded = async (paymentIntent) => {
    const bidId = paymentIntent.metadata?.bid_id;
    try {
        // After capture, confirm local status HELD (funds on platform balance)
        await payment_model_1.Payment.updateMany({
            bidId: bidId,
            stripePaymentIntentId: paymentIntent.id,
        }, {
            status: payment_interface_1.PAYMENT_STATUS.HELD,
        });
        // Do not re-trigger bid acceptance here; amount_capturable_updated handles capture + acceptance
        console.log(`Payment ${paymentIntent.id} succeeded; status set to HELD. No duplicate acceptance triggered.`);
        // Notify the payer about successful payment
        const posterId = paymentIntent.metadata?.poster_id;
        if (posterId) {
            const payment = await payment_model_1.Payment.findOne({
                stripePaymentIntentId: paymentIntent.id,
            }).lean();
            new notification_1.NotificationBuilder()
                .to(posterId)
                .useTemplate('paymentReceived', {
                amount: payment ? `$${payment.amount}` : '',
                orderId: bidId || '',
                orderNumber: bidId || '',
                paymentId: payment?._id?.toString() || '',
            })
                .viaPush()
                .viaDatabase()
                .send()
                .catch(err => logger_1.logger.error('Payment succeeded notification failed', err));
        }
    }
    catch (error) {
        console.error(`Error in handlePaymentSucceeded for payment ${paymentIntent.id}:`, error);
    }
};
// Handle payment failed webhook
const handlePaymentFailed = async (paymentIntent) => {
    const bidId = paymentIntent.metadata.bid_id;
    // Update payment status to REFUNDED
    await payment_model_1.Payment.updateMany({
        bidId: bidId,
        stripePaymentIntentId: paymentIntent.id,
    }, {
        status: payment_interface_1.PAYMENT_STATUS.REFUNDED,
    });
    // Notify the payer about payment failure
    const posterId = paymentIntent.metadata?.poster_id;
    if (posterId) {
        const payment = await payment_model_1.Payment.findOne({
            stripePaymentIntentId: paymentIntent.id,
        }).lean();
        new notification_1.NotificationBuilder()
            .to(posterId)
            .useTemplate('paymentFailed', {
            amount: payment ? `$${payment.amount}` : '',
            orderId: bidId || '',
            orderNumber: bidId || '',
            reason: paymentIntent.last_payment_error?.message || 'Payment was declined',
        })
            .viaPush()
            .viaDatabase()
            .send()
            .catch(err => logger_1.logger.error('Payment failed notification failed', err));
    }
    // Reset bid status back to PENDING so it can be re-attempted
    await BidModel.findByIdAndUpdate(bidId, {
        status: 'pending',
        paymentIntentId: null, // Clear the failed payment intent
    });
    // Revert task assignment and status if this bid was already accepted
    try {
        const bid = await BidModel.findById(bidId);
        if (bid) {
            const task = await TaskModel.findById(bid.taskId);
            if (task) {
                // Only revert if the task is currently assigned to this tasker
                const assignedMatches = task.assignedTo?.toString() === bid.taskerId?.toString();
                if (assignedMatches) {
                    await TaskModel.findByIdAndUpdate(task._id, {
                        status: TaskStatus.OPEN,
                        assignedTo: null,
                        paymentIntentId: null,
                    });
                }
            }
        }
    }
    catch (revertErr) {
        console.error('Failed to revert task state after payment failure:', revertErr);
    }
};
// Moved to stripeConnected.service.ts
// Handle amount capturable updated webhook (manual capture flow)
const handleAmountCapturableUpdated = async (paymentIntent) => {
    const bidId = paymentIntent.metadata?.bid_id;
    try {
        if (!bidId) {
            console.error('❌ No bid_id in payment intent metadata for amount_capturable_updated:', paymentIntent.metadata);
            return;
        }
        // console.log(`Payment ${paymentIntent.id} is now capturable, capturing to hold funds on platform...`);
        try {
            // Capture the payment on the platform account (no transfer_data configured)
            const capturedPayment = await stripe_1.stripe.paymentIntents.capture(paymentIntent.id);
            // console.log(`Payment ${paymentIntent.id} captured successfully (amount_capturable_updated handler)`);
            // Mark local payment as HELD (captured and held in platform balance)
            await payment_model_1.Payment.updateMany({
                bidId: bidId,
                stripePaymentIntentId: paymentIntent.id,
            }, {
                status: payment_interface_1.PAYMENT_STATUS.HELD,
            });
        }
        catch (captureError) {
            console.error(`Failed to capture payment ${paymentIntent.id} in amount_capturable_updated handler:`, captureError);
            if (captureError.message &&
                captureError.message.includes('already been captured')) {
                console.log(`Payment ${paymentIntent.id} was already captured`);
                await payment_model_1.Payment.updateMany({
                    bidId: bidId,
                    stripePaymentIntentId: paymentIntent.id,
                }, {
                    status: payment_interface_1.PAYMENT_STATUS.HELD,
                });
            }
            else {
                return;
            }
        }
        // Complete bid acceptance process after successful capture
        try {
            // Use require to avoid TypeScript compile-time resolution when service is absent
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const bidServiceModule = require('../bid/bid.service');
            const BidService = bidServiceModule?.BidService;
            if (BidService && typeof BidService.completeBidAcceptance === 'function') {
                await BidService.completeBidAcceptance(bidId);
            }
        }
        catch (error) {
            console.error('Failed to complete bid acceptance after capture:', error);
        }
    }
    catch (error) {
        console.error(`Error in handleAmountCapturableUpdated for payment ${paymentIntent.id}:`, error);
    }
};
// Get user payments (for user-specific routes)
const getUserPayments = async (userId, page = 1, limit = 10) => {
    try {
        const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
        const payments = await payment_model_1.Payment.getPaymentsByUser(userObjectId);
        const total = payments.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const paginatedPayments = payments.slice(skip, skip + limit);
        return {
            payments: paginatedPayments.map(mapPaymentToView),
            total,
            totalPages,
            currentPage: page,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to get user payments: ${errorMessage}`);
    }
};
exports.getUserPayments = getUserPayments;
// Get user payment statistics (direct aggregation)
const getUserPaymentStats = async (userId) => {
    try {
        const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
        const matchStage = {
            $or: [{ posterId: userObjectId }, { freelancerId: userObjectId }],
        };
        const [totalStats, statusBreakdown, monthlyTrend] = await Promise.all([
            payment_model_1.Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalPayments: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                        totalPlatformFees: { $sum: '$platformFee' },
                        totalFreelancerPayouts: { $sum: '$freelancerAmount' },
                        averagePayment: { $avg: '$amount' },
                    },
                },
            ]),
            payment_model_1.Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
            payment_model_1.Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                        },
                        totalAmount: { $sum: '$amount' },
                        paymentCount: { $sum: 1 },
                    },
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 },
            ]),
        ]);
        const stats = totalStats[0] || {
            totalPayments: 0,
            totalAmount: 0,
            totalPlatformFees: 0,
            totalFreelancerPayouts: 0,
            averagePayment: 0,
        };
        const statusBreakdownObj = {};
        statusBreakdown.forEach((item) => {
            statusBreakdownObj[item._id] = item.count;
        });
        const monthlyTrendFormatted = monthlyTrend.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            totalAmount: item.totalAmount,
            paymentCount: item.paymentCount,
        }));
        return {
            totalPayments: stats.totalPayments,
            totalAmount: stats.totalAmount,
            totalPlatformFees: stats.totalPlatformFees,
            totalFreelancerPayouts: stats.totalFreelancerPayouts,
            pendingPayments: statusBreakdownObj[payment_interface_1.PAYMENT_STATUS.PENDING] || 0,
            completedPayments: statusBreakdownObj[payment_interface_1.PAYMENT_STATUS.RELEASED] || 0,
            refundedPayments: statusBreakdownObj[payment_interface_1.PAYMENT_STATUS.REFUNDED] || 0,
            averagePayment: stats.averagePayment,
            statusBreakdown: statusBreakdownObj,
            monthlyTrend: monthlyTrendFormatted,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Failed to get user payment stats: ${errorMessage}`);
    }
};
exports.getUserPaymentStats = getUserPaymentStats;
// Moved to stripeConnected.service.ts
// Get payment history for poster, tasker, super admin with QueryBuilder
const getPaymentHistory = async (userId, query) => {
    try {
        // 🔹 Use string directly for Mongoose to cast automatically
        const objectId = userId;
        // Base query (poster or freelancer) + populate freelancer name
        const baseQuery = payment_model_1.Payment.find({
            $or: [{ posterId: objectId }, { freelancerId: objectId }],
        }).populate('freelancerId', 'name'); // populate only name field
        // Query builder with populate
        const queryBuilder = new QueryBuilder_1.default(baseQuery, query)
            .search(['status', 'currency'])
            .filter()
            .dateFilter()
            .sort()
            .paginate()
            .fields();
        // Execute query with pagination
        const { data: payments, pagination } = await queryBuilder.getFilteredResults();
        // Format data
        const formattedPayments = payments.map(payment => ({
            paymentId: payment.stripePaymentIntentId,
            taskerName: payment.freelancerId
                ? payment.freelancerId.name
                : 'N/A',
            amount: payment.amount,
            transactionDate: payment.createdAt,
            paymentStatus: payment.status,
        }));
        return {
            success: true,
            data: formattedPayments,
            pagination,
        };
    }
    catch (error) {
        console.error('Error fetching payment history:', error);
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to fetch payment history');
    }
};
// Retrieve current Stripe PaymentIntent for a bid and return client_secret when applicable
const getCurrentIntentByBid = async (bidId) => {
    if (!mongoose_1.default.isValidObjectId(bidId)) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid bidId');
    }
    const payments = await payment_model_1.Payment.getPaymentsByBid(new mongoose_1.default.Types.ObjectId(bidId));
    if (!payments || payments.length === 0) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'No payment found for this bid');
    }
    // Prefer pending payment; otherwise take the most recent
    const payment = payments.find((p) => p.status === payment_interface_1.PAYMENT_STATUS.PENDING) ||
        payments[0];
    if (!payment.stripePaymentIntentId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Payment does not have a Stripe PaymentIntent');
    }
    const intent = await stripe_1.stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    // Only return client_secret when the intent is awaiting confirmation or action
    const statusesWithSecret = new Set([
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
    ]);
    const response = {
        bidId,
        paymentId: payment._id?.toString(),
        stripePaymentIntentId: intent.id,
        intent_status: intent.status,
    };
    if (statusesWithSecret.has(intent.status) && intent.client_secret) {
        response.client_secret = intent.client_secret;
    }
    return response;
};
exports.getCurrentIntentByBid = getCurrentIntentByBid;
const PaymentService = {
    getPaymentHistory,
    createEscrowPayment: exports.createEscrowPayment,
    releaseEscrowPayment: exports.releaseEscrowPayment,
    refundEscrowPayment: exports.refundEscrowPayment,
    getPaymentById: exports.getPaymentById,
    getPayments: exports.getPayments,
    getPaymentStatsOverview: exports.getPaymentStatsOverview,
    getUserPayments: exports.getUserPayments,
    getUserPaymentStats: exports.getUserPaymentStats,
    handleWebhookEvent: exports.handleWebhookEvent,
    getCurrentIntentByBid: exports.getCurrentIntentByBid,
};
exports.default = PaymentService;
//# sourceMappingURL=payment.service.js.map