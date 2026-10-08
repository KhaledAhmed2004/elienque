import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { DraftService } from './draft.service';

const createDraft = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.id;
  const result = await DraftService.createDraft(req.body, adminId);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Draft created successfully',
    data: result,
  });
});

const updateDraft = catchAsync(async (req: Request, res: Response) => {
  const draftId = req.params.id;
  const adminId = req.user.id;
  const result = await DraftService.updateDraft(draftId, req.body.changes, adminId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Draft updated successfully',
    data: result,
  });
});

const withdrawDraft = catchAsync(async (req: Request, res: Response) => {
  const draftId = req.params.id;
  const adminId = req.user.id;
  const result = await DraftService.withdrawDraft(draftId, adminId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Draft withdrawn successfully',
    data: result,
  });
});

const getMyDrafts = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;
  const result = await DraftService.getMyDrafts(ownerId, req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Drafts retrieved successfully',
    data: result,
  });
});

const approveDraft = catchAsync(async (req: Request, res: Response) => {
  const draftId = req.params.id;
  const ownerId = req.user.id;
  const result = await DraftService.approveDraft(draftId, ownerId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Draft approved and applied successfully',
    data: result,
  });
});

const rejectDraft = catchAsync(async (req: Request, res: Response) => {
  const draftId = req.params.id;
  const ownerId = req.user.id;
  const reason = req.body.reason;
  const result = await DraftService.rejectDraft(draftId, ownerId, reason);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Draft rejected successfully',
    data: result,
  });
});

export const DraftController = {
  createDraft,
  updateDraft,
  withdrawDraft,
  getMyDrafts,
  approveDraft,
  rejectDraft,
};
