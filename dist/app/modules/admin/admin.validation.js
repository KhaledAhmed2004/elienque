"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminValidation = void 0;
const zod_1 = require("zod");
const monthlyTrendsQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        year: zod_1.z
            .union([zod_1.z.string(), zod_1.z.number()])
            .refine(val => !isNaN(Number(val)) && Number(val) >= 2000 && Number(val) <= 2100, {
            message: 'Year must be a valid 4-digit year between 2000 and 2100',
        })
            .optional(),
        range: zod_1.z.enum(['3m', '6m', '12m', 'this-year']).optional(),
        metric: zod_1.z.enum(['all', 'jobs', 'items']).optional(),
    }),
});
const recentActivitiesQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        limit: zod_1.z
            .union([zod_1.z.string(), zod_1.z.number()])
            .refine(val => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 50, {
            message: 'Limit must be a positive integer between 1 and 50',
        })
            .optional(),
    }),
});
exports.AdminValidation = {
    monthlyTrendsQuerySchema,
    recentActivitiesQuerySchema,
};
//# sourceMappingURL=admin.validation.js.map