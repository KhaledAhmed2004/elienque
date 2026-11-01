"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadValidation = void 0;
const zod_1 = require("zod");
const lead_interface_1 = require("./lead.interface");
const createLeadZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        businessName: zod_1.z.string('Business Name is required'),
        ownerName: zod_1.z.string('Owner Name is required'),
        phone: zod_1.z.string('Phone is required'),
        email: zod_1.z.email({
            error: (iss) => iss.input === undefined ? 'Email is required' : 'Invalid email format'
        }),
        address: zod_1.z.string('Address is required'),
    }),
});
const updateLeadStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum([...Object.values(lead_interface_1.LeadStatus)], 'Status is required'),
        adminNote: zod_1.z.string().optional(),
        rejectReason: zod_1.z.string().optional(),
    }),
});
exports.LeadValidation = {
    createLeadZodSchema,
    updateLeadStatusZodSchema,
};
//# sourceMappingURL=lead.validation.js.map