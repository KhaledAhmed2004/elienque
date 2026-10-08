"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportValidation = void 0;
const zod_1 = require("zod");
const createSupportZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z.string().min(1, 'Subject is required'),
        message: zod_1.z.string().min(1, 'Message is required'),
    }),
});
const addMessageZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        message: zod_1.z.string().min(1, 'Message is required'),
    }),
});
exports.SupportValidation = {
    createSupportZodSchema,
    addMessageZodSchema,
};
//# sourceMappingURL=support.validation.js.map