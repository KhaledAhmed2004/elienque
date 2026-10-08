"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignValidation = void 0;
const zod_1 = require("zod");
const createCampaignZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, { message: 'Title is required' }),
        reward: zod_1.z.string().min(1, { message: 'Reward is required' }),
        offer: zod_1.z.string().min(1, { message: 'Offer is required' }),
        startDate: zod_1.z.string().min(1, { message: 'Start Date is required' })
            .refine((date) => !isNaN(Date.parse(date)), {
            message: 'Invalid start date format',
        }),
        endDate: zod_1.z.string().min(1, { message: 'End Date is required' })
            .refine((date) => !isNaN(Date.parse(date)), {
            message: 'Invalid end date format',
        }),
    }).refine(data => new Date(data.startDate) < new Date(data.endDate), {
        message: 'Start Date must be before End Date',
        path: ['startDate'],
    }),
});
const updateCampaignZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1).optional(),
        reward: zod_1.z.string().min(1).optional(),
        offer: zod_1.z.string().min(1).optional(),
        startDate: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: 'Invalid start date format',
        }).optional(),
        endDate: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: 'Invalid end date format',
        }).optional(),
    }),
});
exports.CampaignValidation = {
    createCampaignZodSchema,
    updateCampaignZodSchema,
};
//# sourceMappingURL=campaign.validation.js.map