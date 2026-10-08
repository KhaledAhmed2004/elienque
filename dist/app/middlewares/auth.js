"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_POLICIES = void 0;
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../config"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const jwtHelper_1 = require("../../helpers/jwtHelper");
const user_1 = require("../../enums/user");
/**
 * 🏷️ Predefined self-explanatory authorization policy presets for readable route definitions.
 *
 * Usage:
 * ```ts
 * router.post('/vehicles', auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, AUTH_POLICIES.ALLOW_PENDING_ONBOARDING), ...);
 * ```
 */
exports.AUTH_POLICIES = {
    /**
     * Allows onboarding chauffeurs/users whose accounts are still PENDING admin verification.
     * Required for onboarding steps (e.g. adding vehicle specifications, uploading documents).
     */
    ALLOW_PENDING_ONBOARDING: { allowPending: true },
    /**
     * Allows optional authentication (public route with optional user context).
     */
    OPTIONAL: { optional: true },
    /**
     * Allows suspended/restricted users (e.g. support appeal channels).
     */
    ALLOW_RESTRICTED: { allowRestricted: true },
};
const isJwtUser = (payload) => {
    return (typeof payload === 'object' &&
        payload !== null &&
        'role' in payload &&
        typeof payload.role === 'string' &&
        'id' in payload);
};
const auth = (...args) => {
    const allowedRoles = args.filter((a) => typeof a === 'string');
    const options = args.find((a) => typeof a === 'object' && a !== null) ??
        {};
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            // 1️⃣ No token provided — require authentication for all protected routes
            if (!authHeader) {
                if (options.optional) {
                    return next();
                }
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authorization token is required');
            }
            // 2️⃣ Validate Bearer format
            if (!authHeader.startsWith('Bearer ')) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authorization header must start with "Bearer "');
            }
            // 3️⃣ Extract token and ensure it's not empty
            const token = authHeader.slice(7).trim();
            if (!token) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Valid token is required');
            }
            // 4️⃣ Verify JWT token
            const verifiedPayload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            // 5️⃣ Runtime validation of JWT claims
            if (!isJwtUser(verifiedPayload)) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token payload');
            }
            // 6️⃣ Attach verified user to request
            req.user = verifiedPayload;
            // 7️⃣ Check status from JWT for restricted/pending users
            if (verifiedPayload.accountState === user_1.ACCOUNT_STATE.SUSPENDED &&
                !options.allowRestricted) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account has been restricted. Contact support.');
            }
            if (verifiedPayload.accountState === user_1.ACCOUNT_STATE.UNVERIFIED &&
                !options.allowPending) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your account is pending admin approval. Please wait until your account is verified by an administrator.');
            }
            // 8️⃣ Role-based access check
            if (allowedRoles.length > 0 &&
                !allowedRoles.includes(verifiedPayload.role)) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to access this API");
            }
            // 9️⃣ Proceed
            next();
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'JsonWebTokenError') {
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token'));
                }
                if (error.name === 'TokenExpiredError') {
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token has expired'));
                }
                if (error.name === 'NotBeforeError') {
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token not active'));
                }
            }
            next(error);
        }
    };
};
exports.default = auth;
//# sourceMappingURL=auth.js.map