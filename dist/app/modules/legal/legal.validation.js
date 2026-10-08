"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalValidation = void 0;
const zod_1 = require("zod");
const objectIdValidator = zod_1.z
    .string({ error: 'Legal ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ObjectId format' });
const createLegalPage = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ error: 'Title is required' }).trim().min(1).max(200),
        content: zod_1.z.string().max(100000, 'Content cannot exceed 100,000 characters').optional(),
    }),
});
const getLegalPage = zod_1.z.object({
    params: zod_1.z.object({
        legalId: objectIdValidator,
    }),
});
const updateLegalPage = zod_1.z.object({
    params: zod_1.z.object({
        legalId: objectIdValidator,
    }),
    body: zod_1.z.object({
        title: zod_1.z.string().trim().min(1).max(200).optional(),
        content: zod_1.z.string().max(100000, 'Content cannot exceed 100,000 characters').optional(),
    }),
});
const deleteLegalPage = zod_1.z.object({
    params: zod_1.z.object({
        legalId: objectIdValidator,
    }),
});
exports.LegalValidation = {
    createLegalPage,
    getLegalPage,
    updateLegalPage,
    deleteLegalPage,
};
//# sourceMappingURL=legal.validation.js.map