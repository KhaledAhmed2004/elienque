"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const zod_1 = require("zod");
const api_1 = require("@opentelemetry/api");
const config_1 = __importDefault(require("../../config"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const handleValidationError_1 = __importDefault(require("../../errors/handleValidationError"));
const handleZodError_1 = __importDefault(require("../../errors/handleZodError"));
const handleCastError_1 = __importDefault(require("../../errors/handleCastError"));
const logger_1 = require("../../shared/logger");
// Type Guard: ZodError checking with fallback
const isZodError = (err) => {
    return (err instanceof zod_1.ZodError ||
        (typeof err === 'object' &&
            err !== null &&
            err instanceof Error &&
            err.name === 'ZodError' &&
            Array.isArray(err.issues)));
};
// Sanitized route path for telemetry/logging
const getSafeRoutePath = (req) => {
    try {
        if (req.route && typeof req.route.path === 'string') {
            return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
        }
        if (typeof req.originalUrl === 'string') {
            return req.originalUrl.split('?')[0];
        }
    }
    catch { }
    return 'unknown';
};
const globalErrorHandler = (error, req, res, next) => {
    // 1. Headers already sent edge case
    if (res.headersSent) {
        return next(error);
    }
    // 2. Defensive Telemetry
    let span;
    try {
        const activeSpan = api_1.trace.getActiveSpan();
        if (activeSpan && activeSpan.isRecording()) {
            if (error instanceof Error) {
                activeSpan.recordException(error);
                activeSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            }
            else {
                activeSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: 'Non-Error value thrown' });
            }
        }
        const tracer = api_1.trace.getTracer('app');
        span = tracer.startSpan('Error Handler', undefined, api_1.context.active());
        span.setAttribute('layer', 'Middleware > Error');
        span.setAttribute('http.method', req.method || 'UNKNOWN');
        span.setAttribute('http.route', getSafeRoutePath(req));
        span.addEvent('ERROR_HANDLER_START');
        if (error instanceof Error) {
            span.recordException(error);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
        }
        else {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: 'Non-Error value thrown' });
        }
    }
    catch {
        // Telemetry failure must never stop execution
    }
    // 3. Defensive Logging
    try {
        logger_1.errorLogger.error('🚨 globalErrorHandler ~~ ', error);
    }
    catch (loggerErr) {
        console.error('Failed to log error to Winston:', loggerErr);
    }
    try {
        let statusCode = http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR;
        let message = 'Something went wrong';
        let errorMessages = [];
        let responseData = undefined;
        // 4. Safe Error Classification
        if (isZodError(error)) {
            const simplifiedError = (0, handleZodError_1.default)(error);
            statusCode = simplifiedError.statusCode;
            message = simplifiedError.message;
            errorMessages = simplifiedError.errorMessages;
        }
        else if (typeof error === 'object' &&
            error !== null &&
            error.name === 'ValidationError') {
            try {
                const simplifiedError = (0, handleValidationError_1.default)(error);
                statusCode = simplifiedError.statusCode;
                message = simplifiedError.message;
                errorMessages = simplifiedError.errorMessages;
            }
            catch {
                statusCode = http_status_codes_1.StatusCodes.BAD_REQUEST;
                message = 'Validation Error';
                errorMessages = [];
            }
        }
        else if (typeof error === 'object' &&
            error !== null &&
            error.name === 'CastError') {
            try {
                const simplifiedError = (0, handleCastError_1.default)(error);
                statusCode = simplifiedError.statusCode;
                message = simplifiedError.message;
                errorMessages = simplifiedError.errorMessages;
            }
            catch {
                statusCode = http_status_codes_1.StatusCodes.BAD_REQUEST;
                message = 'Invalid ID format';
                errorMessages = [];
            }
        }
        else if (typeof error === 'object' &&
            error !== null &&
            error.name === 'MongoServerError' &&
            error.code === 11000) {
            statusCode = http_status_codes_1.StatusCodes.CONFLICT;
            const keyValue = error.keyValue;
            const keys = keyValue && typeof keyValue === 'object' ? Object.keys(keyValue) : [];
            const duplicatedField = keys.length > 0 ? keys[0] : 'field';
            message = `${duplicatedField} already exists`;
            errorMessages = [
                { path: duplicatedField, message: `${duplicatedField} must be unique` },
            ];
        }
        else if (typeof error === 'object' &&
            error !== null &&
            error.name === 'TokenExpiredError') {
            statusCode = http_status_codes_1.StatusCodes.UNAUTHORIZED;
            message = 'Session Expired';
            errorMessages = [
                {
                    path: '',
                    message: 'Your session has expired. Please log in again to continue.',
                },
            ];
        }
        else if (typeof error === 'object' &&
            error !== null &&
            (error.message?.includes('Error creating UUID') ||
                error.message?.includes('Inconsistent column data') ||
                error.code === 'P2023')) {
            const isAuthSession = Boolean(req.headers?.authorization);
            statusCode = isAuthSession ? http_status_codes_1.StatusCodes.UNAUTHORIZED : http_status_codes_1.StatusCodes.BAD_REQUEST;
            message = isAuthSession
                ? 'Session is invalid or using a legacy identifier. Please log in again.'
                : 'Invalid ID format: Expected a valid UUID';
            errorMessages = [
                {
                    path: 'id',
                    message,
                },
            ];
        }
        else if (typeof error === 'object' &&
            error !== null &&
            (error.code === 'P2003' ||
                error.code === '23001' ||
                error.message?.includes('violates RESTRICT setting of foreign key constraint') ||
                error.message?.includes('foreign key constraint'))) {
            statusCode = http_status_codes_1.StatusCodes.CONFLICT;
            message =
                'Cannot delete or modify record because it is referenced by other active records (such as passenger bookings or schedules).';
            errorMessages = [
                {
                    path: '',
                    message,
                },
            ];
        }
        else if (error instanceof Error && error.message === 'Not allowed by CORS') {
            statusCode = http_status_codes_1.StatusCodes.FORBIDDEN;
            message = 'CORS blocked: origin not allowed';
            errorMessages = [
                {
                    path: 'Origin',
                    message: 'The request origin is not permitted by CORS policy.',
                },
            ];
            try {
                res.setHeader('X-CORS-Blocked', '1');
                res.setHeader('Vary', 'Origin');
            }
            catch { }
        }
        else if (error instanceof ApiError_1.default) {
            statusCode = error.statusCode;
            message = error.message;
            errorMessages = [];
            if (error.data !== undefined) {
                responseData = error.data;
            }
        }
        else if (error instanceof Error) {
            statusCode = http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR;
            message = config_1.default.node_env === 'development' ? error.message : 'Something went wrong';
            errorMessages =
                config_1.default.node_env === 'development' && error.message
                    ? [{ path: '', message: error.message }]
                    : [];
        }
        // Retain payload for requestLogger.ts
        res.locals.responsePayload = {
            success: false,
            statusCode,
            message,
            errorMessages,
        };
        // Client response
        res.status(statusCode).json({
            success: false,
            message,
            errorMessages,
            ...(responseData !== undefined ? { data: responseData } : {}),
            stack: config_1.default.node_env === 'development' && error instanceof Error ? error.stack : undefined,
        });
    }
    finally {
        if (span) {
            try {
                span.addEvent('FORMATTED_ERROR_RESPONSE');
                span.addEvent('ERROR_HANDLER_COMPLETE');
                span.end();
            }
            catch { }
        }
    }
};
exports.default = globalErrorHandler;
//# sourceMappingURL=globalErrorHandler.js.map