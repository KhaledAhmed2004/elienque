"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const phoneRegex = /^\+?[0-9]{7,15}$/;
// Mirrors NestJS UpdateProfileDto (min 2 chars name) + optional phone/operator details
const updateProfileZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(2, 'Name must be at least 2 characters long').optional(),
        email: zod_1.z.string().email('Invalid email address').optional(),
        phoneNumber: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional().nullable(),
        phone: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional().nullable(),
        companyName: zod_1.z.string().min(1).optional(),
        contactPersonName: zod_1.z.string().min(1).optional(),
        profilePicture: zod_1.z.string().optional(),
    })
        .passthrough(),
});
// Mirrors NestJS UpdatePasswordDto (oldPassword required, newPassword min 8)
const updatePasswordZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        oldPassword: zod_1.z.string().min(1, 'Old password is required').optional(),
        currentPassword: zod_1.z.string().min(1).optional(),
        newPassword: zod_1.z
            .string()
            .min(8, 'New password must be at least 8 characters long'),
    })
        .refine((data) => data.oldPassword || data.currentPassword, {
        message: 'Current password is required',
        path: ['oldPassword'],
    }),
});
const updateStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(client_1.AccountStatus).optional(),
        reason: zod_1.z.string().max(500).optional(),
    }),
});
const suspendUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().max(500).optional(),
    }),
});
const blockUserZodSchema = suspendUserZodSchema;
const rejectUserZodSchema = suspendUserZodSchema;
const deleteUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().optional(),
    }),
});
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
// Mirrors NestJS RegisterDto / User creation
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().min(2, 'Name must be at least 2 characters long').optional(),
        email: zod_1.z.string().min(1, 'Email is required').email('Invalid email address'),
        password: zod_1.z
            .string()
            .min(8, 'Password must be at least 8 characters long')
            .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        phone: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
        phoneNumber: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
        role: zod_1.z
            .enum(client_1.Role)
            .optional()
            .default(client_1.Role.USER),
        companyName: zod_1.z.string().optional(),
        contactPersonName: zod_1.z.string().optional(),
        profilePicture: zod_1.z.string().optional(),
    })
        .passthrough()
        .superRefine((data, ctx) => {
        if (data.role === client_1.Role.OPERATOR) {
            if (!data.companyName) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'companyName is required for operator',
                    path: ['companyName'],
                });
            }
        }
        else {
            if (!data.name || !data.name.trim()) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Name is required',
                    path: ['name'],
                });
            }
        }
        if (!data.phone && !data.phoneNumber) {
            ctx.addIssue({
                code: 'custom',
                message: 'Phone is required',
                path: ['phone'],
            });
        }
    }),
});
exports.UserValidation = {
    updateProfileZodSchema,
    updateUserZodSchema: updateProfileZodSchema,
    updatePasswordZodSchema,
    updateStatusZodSchema,
    suspendUserZodSchema,
    blockUserZodSchema,
    rejectUserZodSchema,
    deleteUserZodSchema,
    createUserZodSchema,
};
//# sourceMappingURL=user.validation.js.map