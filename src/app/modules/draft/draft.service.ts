import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Draft } from './draft.model';
import { sendNotifications } from '../notification/notificationsHelper';
import { User } from '../user/user.model';
import { Campaign } from '../campaign/campaign.model';
import { IDraftStatus } from './draft.interface';
import { INotification } from '../notification/notification.interface';

const createDraft = async (payload: any, adminId: string) => {
  const { targetType, targetId, changes } = payload;

  let ownerId: mongoose.Types.ObjectId | undefined;

  // Resolve ownerId based on targetType
  if (targetType === 'BUSINESS_PROFILE') {
    const user = await User.findById(targetId);
    if (!user || user.role !== 'BUSINESS_OWNER') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Business profile not found');
    }
    ownerId = user._id;
  } else if (targetType === 'CAMPAIGN') {
    const campaign = await Campaign.findById(targetId);
    if (!campaign) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Campaign not found');
    }
    ownerId = campaign.businessId;
  } else {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid targetType');
  }

  // Check for existing pending draft
  const existingPending = await Draft.findOne({
    targetId,
    status: 'PENDING',
  });

  if (existingPending) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A pending draft already exists for this target. Please wait for approval or update the existing draft.'
    );
  }

  // Create draft
  const draft = await Draft.create({
    targetType,
    targetId,
    adminId,
    ownerId,
    changes,
    status: 'PENDING',
  });

  // Send notification to owner
  await sendNotifications({
    text: `An admin has proposed changes to your ${
      targetType === 'CAMPAIGN' ? 'campaign' : 'business profile'
    }. Please review and approve.`,
    receiver: ownerId,
    title: 'Pending Changes Review',
  } as INotification);

  return draft;
};

const updateDraft = async (draftId: string, changes: any, adminId: string) => {
  const draft = await Draft.findOne({ _id: draftId, adminId });
  if (!draft) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Draft not found or you are not the creator');
  }

  if (draft.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending drafts can be updated');
  }

  draft.changes = changes;
  await draft.save();

  return draft;
};

const withdrawDraft = async (draftId: string, adminId: string) => {
  const draft = await Draft.findOne({ _id: draftId, adminId });
  if (!draft) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Draft not found or you are not the creator');
  }

  if (draft.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending drafts can be withdrawn');
  }

  draft.status = 'WITHDRAWN';
  await draft.save();

  return draft;
};

const getMyDrafts = async (ownerId: string, query: Record<string, any>) => {
  const filter: any = { ownerId };
  if (query.status) {
    filter.status = query.status;
  }
  const drafts = await Draft.find(filter).sort({ createdAt: -1 });
  return drafts;
};

const approveDraft = async (draftId: string, ownerId: string) => {
  const draft = await Draft.findOne({ _id: draftId, ownerId });
  if (!draft) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Draft not found or you do not have permission');
  }

  if (draft.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending drafts can be approved');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Apply changes to the target entity
    if (draft.targetType === 'BUSINESS_PROFILE') {
      await User.findByIdAndUpdate(
        draft.targetId,
        { $set: draft.changes },
        { session, new: true, runValidators: true }
      );
    } else if (draft.targetType === 'CAMPAIGN') {
      await Campaign.findByIdAndUpdate(
        draft.targetId,
        { $set: draft.changes },
        { session, new: true, runValidators: true }
      );
    }

    draft.status = 'APPROVED';
    await draft.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify admin
    await sendNotifications({
      text: `Your proposed changes for ${
        draft.targetType === 'CAMPAIGN' ? 'a campaign' : 'a business profile'
      } have been approved.`,
      receiver: draft.adminId,
      title: 'Draft Approved',
    } as INotification);

    return draft;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const rejectDraft = async (draftId: string, ownerId: string, reason?: string) => {
  const draft = await Draft.findOne({ _id: draftId, ownerId });
  if (!draft) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Draft not found or you do not have permission');
  }

  if (draft.status !== 'PENDING') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending drafts can be rejected');
  }

  draft.status = 'REJECTED';
  if (reason) {
    draft.rejectionReason = reason;
  }
  await draft.save();

  // Notify admin
  await sendNotifications({
    text: `Your proposed changes for ${
      draft.targetType === 'CAMPAIGN' ? 'a campaign' : 'a business profile'
    } have been rejected. ${reason ? 'Reason: ' + reason : ''}`,
    receiver: draft.adminId,
    title: 'Draft Rejected',
  } as INotification);

  return draft;
};

export const DraftService = {
  createDraft,
  updateDraft,
  withdrawDraft,
  getMyDrafts,
  approveDraft,
  rejectDraft,
};
