"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ApiError extends Error {
    statusCode;
    data;
    constructor(statusCode, message, stack = '', data) {
        super(message);
        this.statusCode = statusCode;
        this.data = data;
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.default = ApiError;
//# sourceMappingURL=ApiError.js.map