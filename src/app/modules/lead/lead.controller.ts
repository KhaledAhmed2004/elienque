import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { LeadService } from './lead.service';
import { JwtPayload } from 'jsonwebtoken';

const submitLead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const promoterId = user?.id || (user as any)?._id || (user as any)?.userId;

  const result = await LeadService.submitLead(promoterId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Business lead submitted successfully',
    data: result,
  });
});

export const LeadController = {
  submitLead,
};
