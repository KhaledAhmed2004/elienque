"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadValidation = void 0;
const zod_1 = require("zod");
const createLeadZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        businessName: zod_1.z.string({ error: 'Business Name is required' }),
        ownerName: zod_1.z.string({ error: 'Owner Name is required' }),
        phone: zod_1.z.string({ error: 'Phone is required' }),
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email({ message: 'Invalid email format' }),
        address: zod_1.z.string({ error: 'Address is required' }),
    }),
});
exports.LeadValidation = {
    createLeadZodSchema,
};
//# sourceMappingURL=lead.validation.js.map