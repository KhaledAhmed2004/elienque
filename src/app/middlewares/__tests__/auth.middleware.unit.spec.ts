import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import auth from '../auth';
import { jwtHelper } from '../../../helpers/jwtHelper';
import { USER_ROLES, ACCOUNT_STATE, APP_STATE } from '../../../enums/user';
import ApiError from '../../../errors/ApiError';
import { JwtUser } from '../../../types';

describe('Auth Middleware (BDD Suite)', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const getNextError = (): ApiError | undefined => {
    const error: unknown = vi.mocked(next).mock.calls[0]?.[0];
    return error as ApiError | undefined;
  };

  const createValidUser = (overrides?: Partial<JwtUser>): JwtUser => ({
    id: 'usr_12345',
    email: 'test.user@example.com',
    role: USER_ROLES.PROMOTER,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    ...overrides,
  });

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {};
    next = vi.fn();
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. AUTHENTICATION & TOKEN EXTRACTION
  // ==========================================
  describe('Authentication & Token Extraction', () => {
    describe('when the Authorization header is missing', () => {
      it('should reject the request with 401 Unauthorized', async () => {
        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Authorization token is required',
        });
      });
    });

    describe('when the Authorization scheme is not Bearer', () => {
      it('should reject non-Bearer schemes (e.g. Basic) with 401 Unauthorized', async () => {
        req.headers = { authorization: 'Basic dXNlcjpwYXNz' };
        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Authorization header must start with "Bearer "',
        });
      });

      it('should reject lowercase "bearer" scheme with 401 Unauthorized', async () => {
        req.headers = { authorization: 'bearer valid.token.here' };
        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Authorization header must start with "Bearer "',
        });
      });
    });

    describe('when the Bearer token is empty or only whitespace', () => {
      it('should reject an empty token with 401 Unauthorized', async () => {
        req.headers = { authorization: 'Bearer ' };
        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Valid token is required',
        });
      });

      it('should reject a whitespace-only token with 401 Unauthorized', async () => {
        req.headers = { authorization: 'Bearer    ' };
        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Valid token is required',
        });
      });
    });
  });

  // ==========================================
  // 2. JWT VERIFICATION ERRORS
  // ==========================================
  describe('JWT Verification Errors', () => {
    beforeEach(() => {
      req.headers = { authorization: 'Bearer some.jwt.token' };
    });

    describe('when token signature is invalid (JsonWebTokenError)', () => {
      it('should map to 401 with "Invalid token"', async () => {
        const jwtError = new Error('invalid signature');
        jwtError.name = 'JsonWebTokenError';
        vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
          throw jwtError;
        });

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid token',
        });
      });
    });

    describe('when token has expired (TokenExpiredError)', () => {
      it('should map to 401 with "Token has expired"', async () => {
        const expiredError = new Error('jwt expired');
        expiredError.name = 'TokenExpiredError';
        vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
          throw expiredError;
        });

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Token has expired',
        });
      });
    });

    describe('when token is not yet active (NotBeforeError)', () => {
      it('should map to 401 with "Token not active"', async () => {
        const nbfError = new Error('jwt not active');
        nbfError.name = 'NotBeforeError';
        vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
          throw nbfError;
        });

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Token not active',
        });
      });
    });

    describe('when an unexpected non-JWT error occurs', () => {
      it('should forward the original error to next() without masking', async () => {
        const customError = new Error('Internal system fault');
        vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
          throw customError;
        });

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith(customError);
      });
    });
  });

  // ==========================================
  // 3. RUNTIME PAYLOAD VALIDATION
  // ==========================================
  describe('Runtime Payload Validation', () => {
    beforeEach(() => {
      req.headers = { authorization: 'Bearer valid.jwt.token' };
    });

    it('should reject a null payload with 401 Invalid token payload', async () => {
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(null as unknown as JwtUser);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(getNextError()).toMatchObject({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Invalid token payload',
      });
    });

    it('should reject a string/primitive payload with 401 Invalid token payload', async () => {
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue('string_payload' as unknown as JwtUser);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(getNextError()).toMatchObject({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Invalid token payload',
      });
    });

    it('should reject a payload missing the "id" claim', async () => {
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue({
        role: USER_ROLES.PROMOTER,
        email: 'test@example.com',
      } as unknown as JwtUser);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(getNextError()).toMatchObject({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Invalid token payload',
      });
    });

    it('should reject a payload missing the "role" claim', async () => {
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue({
        id: 'usr_123',
        email: 'test@example.com',
      } as unknown as JwtUser);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(getNextError()).toMatchObject({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Invalid token payload',
      });
    });

    it('should reject a payload where "role" is not a string (e.g. array/object)', async () => {
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue({
        id: 'usr_123',
        role: ['ADMIN'],
      } as unknown as JwtUser);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(getNextError()).toMatchObject({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Invalid token payload',
      });
    });
  });

  // ==========================================
  // 4. ACCOUNT STATE GATING
  // ==========================================
  describe('Account State Gating', () => {
    beforeEach(() => {
      req.headers = { authorization: 'Bearer valid.jwt.token' };
    });

    describe('when user account is SUSPENDED', () => {
      it('should reject with 403 Forbidden if allowRestricted is not enabled', async () => {
        const suspendedUser = createValidUser({ accountState: ACCOUNT_STATE.SUSPENDED });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(suspendedUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Your account has been restricted. Contact support.',
        });
      });

      it('should allow access if allowRestricted option is true', async () => {
        const suspendedUser = createValidUser({ accountState: ACCOUNT_STATE.SUSPENDED });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(suspendedUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, { allowRestricted: true });
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toEqual(suspendedUser);
      });
    });

    describe('when user account is VERIFIED or other active state', () => {
      it('should proceed without account restriction error', async () => {
        const verifiedUser = createValidUser({ accountState: ACCOUNT_STATE.VERIFIED });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(verifiedUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toEqual(verifiedUser);
      });
    });
  });

  // ==========================================
  // 5. APPLICATION STATE GATING
  // ==========================================
  describe('Application State Gating', () => {
    beforeEach(() => {
      req.headers = { authorization: 'Bearer valid.jwt.token' };
    });

    describe('when user application is PENDING', () => {
      it('should reject with 403 Forbidden if allowPending is not enabled', async () => {
        const pendingUser = createValidUser({ appState: APP_STATE.PENDING });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(pendingUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          message:
            'Your account is pending admin approval. Please wait until your account is verified by an administrator.',
        });
      });

      it('should allow access if allowPending option is true', async () => {
        const pendingUser = createValidUser({ appState: APP_STATE.PENDING });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(pendingUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, { allowPending: true });
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toEqual(pendingUser);
      });
    });

    describe('when user application is ACTIVE', () => {
      it('should proceed successfully', async () => {
        const activeUser = createValidUser({ appState: APP_STATE.ACTIVE });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(activeUser);

        const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toEqual(activeUser);
      });
    });
  });

  // ==========================================
  // 6. ROLE-BASED ACCESS CONTROL (RBAC)
  // ==========================================
  describe('Role-Based Access Control (RBAC)', () => {
    beforeEach(() => {
      req.headers = { authorization: 'Bearer valid.jwt.token' };
    });

    describe('when route allows a single specific role', () => {
      it('should allow matching user role', async () => {
        const adminUser = createValidUser({ role: USER_ROLES.ADMIN });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(adminUser);

        const middleware = auth(USER_ROLES.ADMIN);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user?.role).toBe(USER_ROLES.ADMIN);
      });

      it('should reject non-matching user role with 403 Forbidden', async () => {
        const regularUser = createValidUser({ role: USER_ROLES.PROMOTER,});
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(regularUser);

        const middleware = auth(USER_ROLES.ADMIN);
        await middleware(req as Request, res as Response, next);

        expect(getNextError()).toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          message: "You don't have permission to access this API",
        });
      });
    });

    describe('when route allows multiple roles (e.g. ADMIN and USER)', () => {
      it('should allow USER role', async () => {
        const user = createValidUser({ role: USER_ROLES.PROMOTER,});
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(user);

        const middleware = auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should allow ADMIN role', async () => {
        const admin = createValidUser({ role: USER_ROLES.ADMIN });
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(admin);

        const middleware = auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
      });
    });

    describe('when route has no role restrictions (empty roles list)', () => {
      it('should allow any authenticated user with a valid token regardless of role', async () => {
        const user = createValidUser({ role: USER_ROLES.PROMOTER,});
        vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(user);

        const middleware = auth();
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toEqual(user);
      });
    });
  });

  // ==========================================
  // 7. SUCCESSFUL AUTHENTICATION & CONTEXT
  // ==========================================
  describe('Successful Authentication & Request Context', () => {
    it('should attach the full verified payload to req.user and call next() with no errors', async () => {
      const fullUserPayload: JwtUser = {
        id: 'usr_complete_99',
        email: 'complete@example.com',
        role: USER_ROLES.PROMOTER,
        accountState: ACCOUNT_STATE.VERIFIED,
        appState: APP_STATE.ACTIVE,
        serviceAreaId: 'area_51',
      };

      req.headers = { authorization: 'Bearer valid.jwt.token' };
      vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(fullUserPayload);

      const middleware = auth(USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual(fullUserPayload);
    });
  });
});
