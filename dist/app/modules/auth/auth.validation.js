"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
const zod_1 = require("zod");
const phoneRegex = /^\+?[0-9]{7,15}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
// 2.1 Register Schema
const registerUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string({ error: 'Name is required' }).min(1),
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address'),
        password: zod_1.z
            .string({ error: 'Password is required' })
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars')
            .max(128, 'Password cannot exceed 128 characters'),
        phone: zod_1.z
            .string({ error: 'Phone is required' })
            .regex(phoneRegex, 'Phone must be 7-15 digits, optional +'),
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
// 2.2 Verify OTP
const verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address'),
        oneTimeCode: zod_1.z.number({ error: 'One time code is required' }),
    }),
});
// 2.3 Resend OTP
const resendOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address'),
    }),
});
// 2.4 Login
const loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ error: 'Email is required' }),
        password: zod_1.z
            .string({ error: 'Password is required' })
            .min(1, 'Password is required'),
    }),
});
// 2.5 Refresh Token
const refreshTokenSchema = zod_1.z.object({
    // Allow empty body when using cookie-based refresh tokens
    body: zod_1.z
        .object({
        refreshToken: zod_1.z.string().optional(),
    })
        .optional(),
});
// Additional Password Management
const forgetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address'),
    }),
});
const resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        newPassword: zod_1.z.string({ error: 'Password is required' }),
        confirmPassword: zod_1.z.string({
            error: 'Confirm Password is required',
        }),
    }),
});
const changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().optional(),
        newPassword: zod_1.z.string({ error: 'New Password is required' }),
        confirmPassword: zod_1.z.string({
            error: 'Confirm Password is required',
        }),
    }),
});
const claimAdminZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address'),
        currentPassword: zod_1.z.string({
            error: 'Current password is required',
        }),
        newPassword: zod_1.z
            .string({ error: 'New password is required' })
            .regex(passwordRegex, 'Password must include upper, lower, number, special and be 8+ chars')
            .max(128, 'Password cannot exceed 128 characters'),
        confirmPassword: zod_1.z.string({
            error: 'Confirm password is required',
        }),
    }),
});
exports.AuthValidation = {
    registerUserZodSchema,
    registerSchema: registerUserZodSchema,
    verifyOtpSchema,
    resendOtpSchema,
    loginSchema,
    refreshTokenSchema,
    forgetPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    claimAdminZodSchema,
    // Backward-compatibility aliases
    createRegisterZodSchema: registerUserZodSchema,
    createVerifyEmailZodSchema: verifyOtpSchema,
    createLoginZodSchema: loginSchema,
    createRefreshTokenZodSchema: refreshTokenSchema,
    createForgetPasswordZodSchema: forgetPasswordSchema,
    createResetPasswordZodSchema: resetPasswordSchema,
    changePasswordZodSchema: changePasswordSchema,
    createChangePasswordZodSchema: changePasswordSchema,
};
//# sourceMappingURL=auth.validation.js.map