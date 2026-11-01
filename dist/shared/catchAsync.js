"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    }
    catch (error) {
        // In Express, next(null) or next(undefined) signals "no error" and skips error middleware.
        // Wrap nullish thrown values so they reliably reach globalErrorHandler.
        next(error ?? new Error('Unhandled null or undefined rejection'));
    }
};
exports.default = catchAsync;
//# sourceMappingURL=catchAsync.js.map