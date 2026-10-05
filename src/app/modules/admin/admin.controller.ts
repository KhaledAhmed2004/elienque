import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AdminService } from './admin.service';

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.getAdminDashboardStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin dashboard stats',
    data: result,
  });
});

const getMonthlyTrends = catchAsync(async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const range = req.query.range as string | undefined;
  const metric = req.query.metric as string | undefined;

  const result = await AdminService.getMonthlyTrends({ year, range, metric });
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Monthly trends retrieved successfully',
    data: result,
  });
});

const getRecentActivities = catchAsync(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 5;
  const result = await AdminService.getRecentActivities(limit);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Recent activities retrieved successfully',
    data: result,
  });
});

export const AdminController = {
  getDashboardStats,
  getMonthlyTrends,
  getRecentActivities,
};
