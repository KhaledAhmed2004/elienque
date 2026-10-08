"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const user_service_1 = require("./user.service");
// Map flat form-data file fields into nested license document structure
const mapLicenseFields = (data, fileKey, expiryKey, docKey) => {
    // Merge flat expiry field (e.g. drivingLicenseExpiryDate) into nested doc
    if (data[expiryKey]) {
        data[docKey] = { ...data[docKey], expiryDate: data[expiryKey] };
        delete data[expiryKey];
    }
    // Merge file URL into nested doc
    if (data[fileKey]) {
        data[docKey] = { ...data[docKey], image: data[fileKey] };
        delete data[fileKey];
    }
    else if (data[docKey] && !data[docKey].image) {
        delete data[docKey];
    }
};
const getUserProfile = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await user_service_1.UserService.getUserProfileFromDB(user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Profile data retrieved successfully',
        data: result,
    });
});
const updateProfile = (0, catchAsync_1.default)(async (req, res) => {
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
    ];
    for (const { fileKey, expiryKey, docKey } of personalLicenseFields) {
        mapLicenseFields(payload, fileKey, expiryKey, docKey);
    }
    // Safe JSON parsing for multipart form fields
    if (typeof payload.paymentMethods === 'string') {
        try {
            payload.paymentMethods = JSON.parse(payload.paymentMethods);
        }
        catch {
            // Handled gracefully by Zod validation
        }
    }
    const result = await user_service_1.UserService.updateProfileToDB(user, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Profile updated successfully',
        data: result,
    });
});
const getAllUserRoles = (0, catchAsync_1.default)(async (req, res) => {
    const result = await user_service_1.UserService.getAllUserRoles(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User roles retrieved successfully',
        pagination: result.pagination,
        data: result.data,
    });
});
const suspendUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const { reason } = req.body;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.suspendChauffeur(id, reason, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chauffeur suspended successfully',
        data: result,
    });
});
const blockUser = suspendUser;
const reactivateUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.reactivateChauffeur(id, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chauffeur reactivated successfully',
        data: result,
    });
});
const unblockUser = reactivateUser;
const getUserById = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const result = await user_service_1.UserService.getUserById(id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User data retrieved successfully',
        data: result,
    });
});
const approveUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.approveChauffeur(id, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chauffeur approved successfully',
        data: result,
    });
});
const rejectUser = (0, catchAsync_1.default)(async (req, res) => {
    const id = req.params.userId || req.params.id;
    const { reason } = req.body;
    const adminUser = req.user;
    const adminId = adminUser?.id || adminUser?._id;
    const result = await user_service_1.UserService.rejectChauffeur(id, reason, adminId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chauffeur application rejected successfully',
        data: result,
    });
});
const getUserDetailsById = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.params.userId || req.params.id;
    const requester = req.user;
    const result = await user_service_1.UserService.getUserDetailsById(userId, requester?.id || requester?.userId, requester?.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User details retrieved successfully',
        data: result,
    });
});
const getMyReviews = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await user_service_1.UserService.getMyReviews(user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Reviews retrieved successfully',
        data: result,
    });
});
const getUserReviews = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.params;
    const result = await user_service_1.UserService.getUserReviews(userId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User reviews retrieved successfully',
        cursor: result.cursor,
        data: result.data,
    });
});
const deleteAccount = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await user_service_1.UserService.deleteAccountFromDB(user.id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Account deleted successfully',
        data: result,
    });
});
const deleteUserByAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.params;
    const result = await user_service_1.UserService.deleteUserByAdmin(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User deleted successfully',
        data: result,
    });
});
const searchChauffeurs = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user?.id || user?.userId || user?._id;
    const result = await user_service_1.UserService.searchChauffeurs(userId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Chauffeurs retrieved successfully',
        cursor: result.cursor,
        data: result.data,
    });
});
const getUserStats = (0, catchAsync_1.default)(async (_req, res) => {
    const result = await user_service_1.UserService.getUserStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User statistics retrieved successfully',
        data: result,
    });
});
exports.UserController = {
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
//# sourceMappingURL=user.controller.js.map