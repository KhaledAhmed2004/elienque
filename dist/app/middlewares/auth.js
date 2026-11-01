"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_POLICIES = void 0;
const http_status_codes_1 = require("http-status-codes");
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("../../config"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const jwtHelper_1 = require("../../helpers/jwtHelper");
const user_1 = require("../../enums/user");
exports.AUTH_POLICIES = {
    ALLOW_PENDING_ONBOARDING: { allowPending: true },
    OPTIONAL: { optional: true },
    ALLOW_RESTRICTED: { allowRestricted: true },
};
const isJwtUser = (payload) => {
    return (typeof payload === 'object' &&
        payload !== null &&
        'role' in payload &&
        typeof payload.role === 'string' &&
        'id' in payload &&
        typeof payload.id === 'string');
};
const checkAccountStatus = (user, options) => {
    const currentStatus = (user.status || user.accountState);
    const isSuspended = currentStatus === client_1.AccountStatus.SUSPENDED ||
        currentStatus === user_1.ACCOUNT_STATE.SUSPENDED;
    if (isSuspended && !options.allowRestricted) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been restricted. Contact support.');
    }
    const isLocked = currentStatus === client_1.AccountStatus.LOCKED ||
        currentStatus === user_1.ACCOUNT_STATE.LOCKED;
    if (isLocked) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is temporarily locked due to security reasons. Contact support.');
    }
    const isDeactivated = currentStatus === client_1.AccountStatus.DEACTIVATED ||
        currentStatus === user_1.ACCOUNT_STATE.DEACTIVATED;
    if (isDeactivated) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been deactivated.');
    }
    const isPending = currentStatus === client_1.AccountStatus.UNVERIFIED ||
        currentStatus === user_1.ACCOUNT_STATE.UNVERIFIED;
    if (isPending && !options.allowPending) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is pending admin approval. Please wait until your account is verified by an administrator.');
    }
};
const checkRoleAccess = (userRole, allowedRoles) => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to access this API");
    }
};
const formatJwtError = (error) => {
    if (error instanceof Error) {
        if (error.name === 'JsonWebTokenError') {
            return new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token');
        }
        if (error.name === 'TokenExpiredError') {
            return new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token has expired');
        }
        if (error.name === 'NotBeforeError') {
            return new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token not active');
        }
    }
    return null;
};
const auth = (...args) => {
    const allowedRoles = args.filter((arg) => typeof arg === 'string');
    const options = args.find((arg) => typeof arg === 'object' && arg !== null) ?? {};
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                if (options.optional) {
                    return next();
                }
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authorization token is required');
            }
            if (!authHeader.startsWith('Bearer ')) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authorization header must start with "Bearer "');
            }
            const token = authHeader.slice(7).trim();
            if (!token) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Valid token is required');
            }
            const verifiedPayload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            if (!isJwtUser(verifiedPayload)) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token payload');
            }
            if (/^[0-9a-fA-F]{24}$/.test(verifiedPayload.id)) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Session is invalid or using a legacy identifier. Please log in again.');
            }
            req.user = verifiedPayload;
            checkAccountStatus(verifiedPayload, options);
            checkRoleAccess(verifiedPayload.role, allowedRoles);
            next();
        }
        catch (error) {
            const jwtError = formatJwtError(error);
            if (jwtError) {
                return next(jwtError);
            }
            next(error);
        }
    };
};
exports.default = auth;
//# sourceMappingURL=auth.js.map