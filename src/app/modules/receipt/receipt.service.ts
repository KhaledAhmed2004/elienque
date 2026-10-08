import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { Receipt } from './receipt.model';
import { CampaignParticipant } from '../campaign/campaignParticipant.model';
import { User } from '../user/user.model';
import { RECEIPT_STATUS } from '../../../enums/reward';
import { USER_ROLES } from '../../../enums/user';

const uploadReceipt = async (user: JwtPayload, payload: any) => {
  const { campaignId, fileUrl } = payload;
  
  // Verify promoter joined campaign
  const participant = await CampaignParticipant.findOne({
    campaignId,
    promoterId: user.id
  });

  if (!participant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You must join the campaign before uploading a receipt');
  }

  const receipt = await Receipt.create({
    promoterId: user.id,
    campaignId,
    fileUrl,
    status: RECEIPT_STATUS.PENDING
  });

  return receipt;
};

const getReceipts = async (user: JwtPayload, query: any) => {
  const filter: any = {};
  
  if (user.role === USER_ROLES.PROMOTER) {
    filter.promoterId = user.id;
  }
  
  const receipts = await Receipt.find(filter)
    .populate('promoterId', 'name email profilePicture')
    .populate('campaignId', 'title reward')
    .sort({ createdAt: -1 });

  return receipts;
};

const approveReceipt = async (id: string, user: JwtPayload, payload: any) => {
  const receipt = await Receipt.findById(id);

  if (!receipt) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receipt not found');
  }

  if (receipt.status !== RECEIPT_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Receipt is not in pending status');
  }

  const { amountEarned } = payload;

  receipt.status = RECEIPT_STATUS.APPROVED;
  receipt.amountEarned = amountEarned;
  receipt.reviewedBy = user.id as any;
  receipt.reviewedAt = new Date();

  // Increment promoter's balance
  const promoter = await User.findById(receipt.promoterId);
  if (promoter) {
    promoter.rewardBalance = (promoter.rewardBalance || 0) + amountEarned;
    await promoter.save();
  }

  await receipt.save();

  return receipt;
};

const rejectReceipt = async (id: string, user: JwtPayload, payload: any) => {
  const receipt = await Receipt.findById(id);

  if (!receipt) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receipt not found');
  }

  if (receipt.status !== RECEIPT_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Receipt is not in pending status');
  }

  receipt.status = RECEIPT_STATUS.REJECTED;
  receipt.rejectionReason = payload.rejectionReason;
  receipt.reviewedBy = user.id as any;
  receipt.reviewedAt = new Date();

  await receipt.save();

  return receipt;
};

export const ReceiptService = {
  uploadReceipt,
  getReceipts,
  approveReceipt,
  rejectReceipt
};
