import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { CampaignService } from './campaign.service';
import { JwtPayload } from 'jsonwebtoken';

const createCampaign = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await CampaignService.createCampaign(user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Campaign created successfully',
    data: result,
  });
});

const updateCampaign = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await CampaignService.updateCampaign(id, user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Campaign updated successfully',
    data: result,
  });
});

const activateCampaign = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await CampaignService.activateCampaign(id, user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Campaign activated successfully',
    data: result,
  });
});

const getActiveCampaigns = catchAsync(async (req: Request, res: Response) => {
  const result = await CampaignService.getActiveCampaigns();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Active campaigns retrieved successfully',
    data: result,
  });
});

const joinCampaign = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = req.user as JwtPayload;
  const result = await CampaignService.joinCampaign(id, user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Successfully joined the campaign',
    data: result,
  });
});

export const CampaignController = {
  createCampaign,
  updateCampaign,
  activateCampaign,
  getActiveCampaigns,
  joinCampaign,
};
