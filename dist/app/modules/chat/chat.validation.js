"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatValidation = void 0;
const zod_1 = require("zod");
const createChatZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        participantId: zod_1.z
            .string({ error: 'Participant ID is required' })
            .min(1, { message: 'Participant ID is required' }),
        itemId: zod_1.z.string().min(1).optional(),
        jobId: zod_1.z.string().min(1).optional(),
        supportId: zod_1.z.string().min(1).optional(),
    }),
});
const getChatByIdZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        chatId: zod_1.z
            .string({ error: 'Chat ID is required' })
            .min(1, { message: 'Chat ID is required' }),
    }),
});
const deleteChatZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        chatId: zod_1.z
            .string({ error: 'Chat ID is required' })
            .min(1, { message: 'Chat ID is required' }),
    }),
});
const getMyChatsQueryZodSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        searchTerm: zod_1.z.string().trim().max(100).optional(),
        page: zod_1.z.coerce.number().int().positive().optional(),
        limit: zod_1.z.coerce.number().int().positive().max(100).optional(),
    })
        .optional(),
});
exports.ChatValidation = {
    createChatZodSchema,
    getChatByIdZodSchema,
    deleteChatZodSchema,
    getMyChatsQueryZodSchema,
};
//# sourceMappingURL=chat.validation.js.map