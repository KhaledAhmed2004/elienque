import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { APP_STATE } from '../../../enums/user';
import { JwtPayload } from 'jsonwebtoken';

// Map flat form-data file fields into nested license document structure
const mapLicenseFields = (
  data: Record<string, any>,
  fileKey: string,
  expiryKey: string,
  docKey: string,
) => {
  // Merge flat expiry field (e.g. drivingLicenseExpiryDate) into nested doc
  if (data[expiryKey]) {
    data[docKey] = { ...data[docKey], expiryDate: data[expiryKey] };
    delete data[expiryKey];
  }

  // Merge file URL into nested doc
  if (data[fileKey]) {
    data[docKey] = { ...data[docKey], image: data[fileKey] };
    delete data[fileKey];
  } else if (data[docKey] && !data[docKey].image) {
    delete data[docKey];
  }
};

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await UserService.getUserProfileFromDB(user as JwtPayload);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile data retrieved successfully',
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const payload = { ...req.body };

  // Map personal license doc fields (User-level)
  const personalLicenseFields = [
    {
      fileKey: 'drivingLicenseImage',
      expiryKey: 'drivingLicenseExpiryDate',
      docKey: 'drivingLicense',
    },
    {
      fileKey: 'hackLicenseImage',
      expiryKey: 'hackLicenseExpiryDate',
      docKey: 'hackLicense',
    },
    {
      fileKey: 'localPermitImage',
      expiryKey: 'localPermitExpiryDate',
      docKey: 'localPermit',
    },
  ] as const;

  for (const { fileKey, expiryKey, docKey } of personalLicenseFields) {
    mapLicenseFields(payload, fileKey, expiryKey, docKey);
  }

  // Safe JSON parsing for multipart form fields
  if (typeof payload.paymentMethods === 'string') {
    try {
      payload.paymentMethods = JSON.parse(payload.paymentMethods);
    } catch {
      // Handled gracefully by Zod validation
    }
  }

  const result = await UserService.updateProfileToDB(
    user as JwtPayload,
    payload,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: result,
  });
});

const getAllUserRoles = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUserRoles(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User roles retrieved successfully',
    pagination: result.pagination,
    data: result.data,
  });
});

const suspendUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId || req.params.id;
  const { reason } = req.body;
  const adminUser = req.user as JwtPayload | undefined;
  const adminId = adminUser?.id || (adminUser as any)?._id;
  const result = await UserService.suspendChauffeur(id, reason, adminId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chauffeur suspended successfully',
    data: result,
  });
});

const blockUser = suspendUser;

const reactivateUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId || req.params.id;
  const adminUser = req.user as JwtPayload | undefined;
  const adminId = adminUser?.id || (adminUser as any)?._id;
  const result = await UserService.reactivateChauffeur(id, adminId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chauffeur reactivated successfully',
    data: result,
  });
});

const unblockUser = reactivateUser;

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId || req.params.id;
  const result = await UserService.getUserById(id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User data retrieved successfully',
    data: result,
  });
});

const approveUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId || req.params.id;
  const adminUser = req.user as JwtPayload | undefined;
  const adminId = adminUser?.id || (adminUser as any)?._id;
  const result = await UserService.approveChauffeur(id, adminId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chauffeur approved successfully',
    data: result,
  });
});

const rejectUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId || req.params.id;
  const { reason } = req.body;
  const adminUser = req.user as JwtPayload | undefined;
  const adminId = adminUser?.id || (adminUser as any)?._id;
  const result = await UserService.rejectChauffeur(id, reason, adminId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chauffeur application rejected successfully',
    data: result,
  });
});

const getUserDetailsById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId || req.params.id;
  const requester = req.user as JwtPayload | undefined;

  const result = await UserService.getUserDetailsById(
    userId,
    requester?.id || (requester as any)?.userId,
    requester?.role,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.getMyReviews(user.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Reviews retrieved successfully',
    data: result,
  });
});

const getUserReviews = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await UserService.getUserReviews(userId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User reviews retrieved successfully',
    cursor: result.cursor,
    data: result.data,
  });
});

const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.deleteAccountFromDB(user.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Account deleted successfully',
    data: result,
  });
});

const deleteUserByAdmin = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await UserService.deleteUserByAdmin(userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted successfully',
    data: result,
  });
});

const searchChauffeurs = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const userId = user?.id || (user as any)?.userId || (user as any)?._id;
  const result = await UserService.searchChauffeurs(userId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chauffeurs retrieved successfully',
    cursor: result.cursor,
    data: result.data,
  });
});

const getUserStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await UserService.getUserStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User statistics retrieved successfully',
    data: result,
  });
});

export const UserController = {
  getUserProfile,
  updateProfile,
  getAllUserRoles,
  suspendUser,
  reactivateUser,
  blockUser,
  unblockUser,
  getUserById,
  approveUser,
  rejectUser,
  getUserDetailsById,
  getMyReviews,
  getUserReviews,
  deleteAccount,
  deleteUserByAdmin,
  searchChauffeurs,
  getUserStats,
};
