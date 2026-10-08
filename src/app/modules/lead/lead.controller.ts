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

const getAllLeads = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await LeadService.getAllLeads(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Business leads retrieved successfully',
    pagination: meta,
    data: result,
  });
});

const getMyLeads = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const promoterId = user?.id || (user as any)?._id || (user as any)?.userId;

  const { meta, result } = await LeadService.getMyLeads(promoterId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your leads retrieved successfully',
    pagination: meta,
    data: result,
  });
});

const getSingleLead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const userId = user?.id || (user as any)?._id || (user as any)?.userId;
  const userRole = user?.role;

  const result = await LeadService.getSingleLead(req.params.id, userRole, userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Lead retrieved successfully',
    data: result,
  });
});

const updateLeadStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await LeadService.updateLeadStatus(req.params.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Lead status updated successfully',
    data: result,
  });
});

export const LeadController = {
  submitLead,
  getAllLeads,
  getMyLeads,
  getSingleLead,
  updateLeadStatus,
};
