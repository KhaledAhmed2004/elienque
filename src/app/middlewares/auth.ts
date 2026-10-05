import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import ApiError from '../../errors/ApiError';
import { jwtHelper } from '../../helpers/jwtHelper';
import { USER_ROLES, APP_STATE, ACCOUNT_STATE } from '../../enums/user';
import { JwtUser } from '../../types';

/**
 * Configuration options for route authorization middleware.
 */
export type AuthOptions = {
  /**
   * 🛡️ Allow Restricted / Suspended Accounts:
   * When `true`, users with `ACCOUNT_STATE.SUSPENDED` can still access this route.
   * Useful for: Support chat, appeals, payment settlement, account recovery.
   */
  allowRestricted?: boolean;

  /**
   * 🚗 Allow Onboarding Pending Accounts (e.g. Chauffeurs awaiting admin approval):
   * When `true`, newly registered users whose account status is `APP_STATE.PENDING` can access this route.
   * Useful for: Onboarding steps like uploading driver documents, adding vehicle specs/photos before admin verification.
   *
   * @default false (blocks pending users with HTTP 403 Forbidden until verified by admin)
   */
  allowPending?: boolean;

  /**
   * 🔓 Optional Authentication:
   * When `true`, unauthenticated requests are allowed through (`req.user` remains undefined).
   * If a valid Bearer token is provided, `req.user` will be populated.
   */
  optional?: boolean;
};

/**
 * 🏷️ Predefined self-explanatory authorization policy presets for readable route definitions.
 *
 * Usage:
 * ```ts
 * router.post('/vehicles', auth(USER_ROLES.USER, AUTH_POLICIES.ALLOW_PENDING_ONBOARDING), ...);
 * ```
 */
export const AUTH_POLICIES = {
  /**
   * Allows onboarding chauffeurs/users whose accounts are still PENDING admin verification.
   * Required for onboarding steps (e.g. adding vehicle specifications, uploading documents).
   */
  ALLOW_PENDING_ONBOARDING: { allowPending: true } as const,

  /**
   * Allows optional authentication (public route with optional user context).
   */
  OPTIONAL: { optional: true } as const,

  /**
   * Allows suspended/restricted users (e.g. support appeal channels).
   */
  ALLOW_RESTRICTED: { allowRestricted: true } as const,
} as const;

type AuthArgument = USER_ROLES | string | AuthOptions;

const isJwtUser = (payload: unknown): payload is JwtUser => {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'role' in payload &&
    typeof (payload as { role: unknown }).role === 'string' &&
    'id' in payload
  );
};

const auth = (...args: AuthArgument[]) => {
  const allowedRoles = args.filter(
    (a): a is USER_ROLES | string => typeof a === 'string',
  );
  const options: AuthOptions =
    args.find((a): a is AuthOptions => typeof a === 'object' && a !== null) ??
    {};

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      // 1️⃣ No token provided — require authentication for all protected routes
      if (!authHeader) {
        if (options.optional) {
          return next();
        }
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Authorization token is required',
        );
      }

      // 2️⃣ Validate Bearer format
      if (!authHeader.startsWith('Bearer ')) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Authorization header must start with "Bearer "',
        );
      }

      // 3️⃣ Extract token and ensure it's not empty
      const token = authHeader.slice(7).trim();
      if (!token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Valid token is required');
      }

      // 4️⃣ Verify JWT token
      const verifiedPayload = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as Secret,
      );

      // 5️⃣ Runtime validation of JWT claims
      if (!isJwtUser(verifiedPayload)) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token payload');
      }

      // 6️⃣ Attach verified user to request
      req.user = verifiedPayload;

      // 7️⃣ Check status from JWT for restricted/pending users
      if (
        verifiedPayload.accountState === ACCOUNT_STATE.SUSPENDED &&
        !options.allowRestricted
      ) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'Your account has been restricted. Contact support.',
        );
      }

      if (
        verifiedPayload.appState === APP_STATE.PENDING &&
        !options.allowPending
      ) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'Your account is pending admin approval. Please wait until your account is verified by an administrator.',
        );
      }

      // 8️⃣ Role-based access check
      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(verifiedPayload.role)
      ) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to access this API",
        );
      }

      // 9️⃣ Proceed
      next();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'JsonWebTokenError') {
          return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
          return next(
            new ApiError(StatusCodes.UNAUTHORIZED, 'Token has expired'),
          );
        }
        if (error.name === 'NotBeforeError') {
          return next(
            new ApiError(StatusCodes.UNAUTHORIZED, 'Token not active'),
          );
        }
      }

      next(error);
    }
  };
};

export default auth;
