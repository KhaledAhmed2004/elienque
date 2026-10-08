import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { CashOutService } from './cashOut.service';
import { JwtPayload } from 'jsonwebtoken';

const requestCashOut = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await CashOutService.requestCashOut(user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Cash out requested successfully',
    data: result,
  });
});

const getCashOuts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await CashOutService.getCashOuts(user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Cash out requests retrieved successfully',
    data: result,
  });
});

const approveCashOut = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await CashOutService.approveCashOut(id, user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Cash out request approved and marked as paid',
    data: result,
  });
});

const rejectCashOut = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await CashOutService.rejectCashOut(id, user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Cash out request rejected successfully',
    data: result,
  });
});

export const CashOutController = {
  requestCashOut,
  getCashOuts,
  approveCashOut,
  rejectCashOut,
};
