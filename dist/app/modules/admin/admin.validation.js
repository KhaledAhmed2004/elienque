"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminValidation = void 0;
const zod_1 = require("zod");
const updateCommissionZodSchema = zod_1.z.object({
    rate: zod_1.z.number().min(0).max(100).optional(),
    schedule: zod_1.z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
});
const updatePlatformZodSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Platform name cannot be empty').optional(),
    email: zod_1.z.email('Valid support email required').optional(),
});
exports.AdminValidation = {
    updateCommissionZodSchema,
    updatePlatformZodSchema,
};
//# sourceMappingURL=admin.validation.js.map