"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const phoneRegex = /^\+?[0-9]{7,15}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
const paymentMethodsSchema = zod_1.z
    .union([
    zod_1.z.object({
        zelle: zod_1.z
            .object({
            email: zod_1.z.string().email('Invalid email address').optional(),
        })
            .optional(),
        venmo: zod_1.z
            .object({
            username: zod_1.z.string().optional(),
        })
            .optional(),
        cashApp: zod_1.z
            .object({
            cashtag: zod_1.z.string().optional(),
        })
            .optional(),
        cardPayment: zod_1.z
            .object({
            status: zod_1.z
                .enum(Object.values(user_1.CARD_PAYMENT_STATUS))
                .optional(),
        })
            .optional(),
    }),
    zod_1.z.string().transform(val => {
        try {
            const parsed = JSON.parse(val);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch {
            return {};
        }
    }),
])
    .optional();
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(1, 'Name is required'),
        nickname: zod_1.z.string().min(1).max(50).optional(),
        email: zod_1.z.string().min(1, 'Email is required').email('Invalid email address'),
        password: zod_1.z
            .string().min(1, 'Password is required')
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars'),
        phone: zod_1.z
            .string().min(1, 'Phone is required')
            .regex(phoneRegex, 'Phone must be 7-15 digits, optional +'),
        profilePicture: zod_1.z.string().optional(),
        paymentMethods: paymentMethodsSchema,
        role: zod_1.z.enum(['PROMOTER', 'BUSINESS_OWNER', 'ADMIN']).optional(),
        businessName: zod_1.z.string().optional(),
    })
        .superRefine((data, ctx) => {
        if (data.role === 'BUSINESS_OWNER' && (!data.businessName || data.businessName.trim() === '')) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Business name is required for Business Owners',
                path: ['businessName'],
            });
        }
    }),
});
const updateUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        nickname: zod_1.z.string().max(50).optional(),
        email: zod_1.z.string().email('Invalid email address').optional(),
        phone: zod_1.z
            .string()
            .regex(phoneRegex, 'Phone must be 7-15 digits, optional +')
            .optional(),
        experience: zod_1.z.coerce.number().min(0).optional(),
        password: zod_1.z
            .string()
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars')
            .optional(),
        profilePicture: zod_1.z.string().optional(),
        paymentMethods: paymentMethodsSchema,
        businessName: zod_1.z.string().optional(),
    }),
});
const suspendUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().max(500).optional(),
    }),
});
const blockUserZodSchema = suspendUserZodSchema;
const rejectUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().max(500).optional(),
    }),
});
const deleteUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1, 'Password is required for account deletion'),
    }),
});
exports.UserValidation = {
    createUserZodSchema,
    updateUserZodSchema,
    suspendUserZodSchema,
    blockUserZodSchema,
    rejectUserZodSchema,
    deleteUserZodSchema,
};
//# sourceMappingURL=user.validation.js.map