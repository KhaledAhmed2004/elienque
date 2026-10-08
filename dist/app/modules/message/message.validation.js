"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageValidation = void 0;
const zod_1 = require("zod");
const objectIdValidator = zod_1.z
    .string({ error: 'Chat ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');
const sendMessageZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        chatId: objectIdValidator,
    }),
    body: zod_1.z
        .object({
        text: zod_1.z.string().max(4000).optional(),
        attachments: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        file: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        image: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        files: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        replyTo: zod_1.z
            .string()
            .optional()
            .refine(val => {
            if (!val)
                return true;
            return /^[0-9a-fA-F]{24}$/.test(val);
        }, 'Invalid replyTo format'),
    })
        .refine(data => data.text ||
        data.attachments ||
        data.file ||
        data.image ||
        data.files, {
        message: 'Either text or attachments must be provided',
        path: ['text'],
    }),
});
const getMessagesZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        chatId: objectIdValidator,
    }),
    query: zod_1.z.object({
        limit: zod_1.z.string().optional(),
        cursor: zod_1.z.string().optional(),
        searchTerm: zod_1.z.string().optional(),
    }),
});
exports.MessageValidation = { sendMessageZodSchema, getMessagesZodSchema };
//# sourceMappingURL=message.validation.js.map