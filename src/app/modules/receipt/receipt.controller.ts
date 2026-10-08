import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ReceiptService } from './receipt.service';
import { JwtPayload } from 'jsonwebtoken';

const uploadReceipt = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await ReceiptService.uploadReceipt(user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Receipt uploaded successfully',
    data: result,
  });
});

const getReceipts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await ReceiptService.getReceipts(user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Receipts retrieved successfully',
    data: result,
  });
});

const approveReceipt = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await ReceiptService.approveReceipt(id, user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Receipt approved successfully',
    data: result,
  });
});

const rejectReceipt = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await ReceiptService.rejectReceipt(id, user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Receipt rejected successfully',
    data: result,
  });
});

export const ReceiptController = {
  uploadReceipt,
  getReceipts,
  approveReceipt,
  rejectReceipt,
};
