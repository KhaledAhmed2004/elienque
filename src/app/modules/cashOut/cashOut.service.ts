import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { CashOutRequest } from './cashOut.model';
import { User } from '../user/user.model';
import { CASH_OUT_STATUS } from '../../../enums/reward';

const requestCashOut = async (user: JwtPayload, payload: any) => {
  const { amount, paymentMethod, paymentDetails } = payload;
  
  // Check if promoter has enough balance
  const promoter = await User.findById(user.id);
  if (!promoter) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if ((promoter.rewardBalance || 0) < amount) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Insufficient reward balance');
  }

  // Enforce single pending request
  const existingPending = await CashOutRequest.findOne({
    promoterId: user.id,
    status: CASH_OUT_STATUS.PENDING
  });

  if (existingPending) {
    throw new ApiError(StatusCodes.CONFLICT, 'You already have a pending cash out request');
  }

  const cashOut = await CashOutRequest.create({
    promoterId: user.id,
    amount,
    paymentMethod,
    paymentDetails,
    status: CASH_OUT_STATUS.PENDING
  });

  return cashOut;
};

const getCashOuts = async (user: JwtPayload, query: any) => {
  const filter: any = {};
  
  // Promoters see their own, admins see all
  if (user.role !== 'ADMIN') {
    filter.promoterId = user.id;
  }
  
  const cashOuts = await CashOutRequest.find(filter)
    .populate('promoterId', 'name email phone profilePicture')
    .sort({ createdAt: -1 });

  return cashOuts;
};

const approveCashOut = async (id: string, user: JwtPayload, payload: any) => {
  const cashOut = await CashOutRequest.findById(id);

  if (!cashOut) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Cash out request not found');
  }

  if (cashOut.status !== CASH_OUT_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Request is not in pending status');
  }

  const promoter = await User.findById(cashOut.promoterId);
  if (!promoter || (promoter.rewardBalance || 0) < cashOut.amount) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Promoter no longer has sufficient balance');
  }

  // Deduct balance
  promoter.rewardBalance = (promoter.rewardBalance || 0) - cashOut.amount;
  await promoter.save();

  cashOut.status = CASH_OUT_STATUS.PAID;
  cashOut.transactionReference = payload.transactionReference;
  cashOut.processedBy = user.id as any;
  cashOut.processedAt = new Date();

  await cashOut.save();

  return cashOut;
};

const rejectCashOut = async (id: string, user: JwtPayload, payload: any) => {
  const cashOut = await CashOutRequest.findById(id);

  if (!cashOut) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Cash out request not found');
  }

  if (cashOut.status !== CASH_OUT_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Request is not in pending status');
  }

  cashOut.status = CASH_OUT_STATUS.REJECTED;
  cashOut.rejectionReason = payload.rejectionReason;
  cashOut.processedBy = user.id as any;
  cashOut.processedAt = new Date();

  await cashOut.save();

  return cashOut;
};

export const CashOutService = {
  requestCashOut,
  getCashOuts,
  approveCashOut,
  rejectCashOut
};
