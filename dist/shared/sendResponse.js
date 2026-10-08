"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sendResponse = (res, data) => {
    // 👇 store full response data for logger middleware
    res.locals.responsePayload = data;
    const resData = {
        success: data.success,
        message: data.message,
        ...(data.pagination !== undefined && { pagination: data.pagination }),
        ...(data.cursor !== undefined && { cursor: data.cursor }),
        data: data.data,
    };
    res.status(data.statusCode).json(resData);
};
exports.default = sendResponse;
//# sourceMappingURL=sendResponse.js.map