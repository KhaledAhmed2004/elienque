"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const phoneRegex = /^\+?[0-9]{7,15}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
// Register Schema
const registerUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string().optional(),
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
        password: zod_1.z
            .string({ error: 'Password is required' })
            .min(8, 'Password must be at least 8 characters long')
            .max(128, 'Password cannot exceed 128 characters')
            .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        phone: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
        phoneNumber: zod_1.z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
        role: zod_1.z
            .enum([
            user_1.USER_ROLES.USER,
            user_1.USER_ROLES.OPERATOR,
            user_1.USER_ROLES.ADMIN,
            user_1.USER_ROLES.PROMOTER,
            user_1.USER_ROLES.BUSINESS_OWNER,
        ])
            .optional()
            .default(user_1.USER_ROLES.USER),
        companyName: zod_1.z.string().optional(),
        contactPersonName: zod_1.z.string().optional(),
        businessName: zod_1.z.string().optional(),
        profilePicture: zod_1.z.string().optional(),
    })
        .passthrough()
        .superRefine((data, ctx) => {
        const isOperator = data.role === user_1.USER_ROLES.OPERATOR;
        const isBusinessOwner = data.role === user_1.USER_ROLES.BUSINESS_OWNER;
        if (isBusinessOwner) {
            if (!data.businessName) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'businessName is required for registration validation',
                    path: ['businessName'],
                });
            }
        }
        else if (isOperator) {
            if (!data.companyName && !data.businessName) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'companyName is required for operator registration',
                    path: ['companyName'],
                });
            }
            if (!data.contactPersonName && !data.name) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'contactPersonName is required for operator registration',
                    path: ['contactPersonName'],
                });
            }
        }
        else {
            if (!data.name || !data.name.trim()) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'name is required for user registration',
                    path: ['name'],
                });
            }
        }
        if (!data.phone && !data.phoneNumber) {
            ctx.addIssue({
                code: 'custom',
                message: 'phoneNumber is required',
                path: ['phoneNumber'],
            });
        }
    }),
});
// Verify OTP / Email Schema
const verifyOtpSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
        otp: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
        oneTimeCode: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    })
        .passthrough()
        .superRefine((data, ctx) => {
        const code = data.otp ?? data.oneTimeCode;
        if (code === undefined || String(code).trim().length === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'OTP is required',
                path: ['otp'],
            });
        }
    }),
});
// Resend OTP Schema
const resendOtpSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
    })
        .passthrough(),
});
// Login Schema
const loginSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
        password: zod_1.z
            .string({ error: 'Password is required' })
            .min(1, 'Password is required'),
        deviceToken: zod_1.z.string().optional(),
    })
        .passthrough(),
});
// Refresh Token Schema
const refreshTokenSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        sessionId: zod_1.z.string().optional(),
        refreshToken: zod_1.z.string().optional(),
    })
        .optional(),
});
// Forgot Password Schema
const forgetPasswordSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
    })
        .passthrough(),
});
// Reset Password Schema
const resetPasswordSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string()
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim())
            .optional(),
        token: zod_1.z.string().optional(),
        newPassword: zod_1.z
            .string({ error: 'Password is required' })
            .min(8, 'Password must be at least 8 characters long'),
        confirmPassword: zod_1.z.string().optional(),
    })
        .passthrough(),
});
// Change Password Schema
const changePasswordSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        currentPassword: zod_1.z.string().optional(),
        oldPassword: zod_1.z.string().optional(),
        newPassword: zod_1.z
            .string({ error: 'New Password is required' })
            .min(8, 'Password must be at least 8 characters long'),
        confirmPassword: zod_1.z.string().optional(),
    })
        .passthrough()
        .superRefine((data, ctx) => {
        if (!data.currentPassword && !data.oldPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Current password is required',
                path: ['oldPassword'],
            });
        }
    }),
});
const createChangePasswordZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        currentPassword: zod_1.z.string().optional(),
        oldPassword: zod_1.z.string().optional(),
        newPassword: zod_1.z
            .string({ error: 'New Password is required' })
            .min(8, 'Password must be at least 8 characters long'),
        confirmPassword: zod_1.z.string({
            error: 'Confirm Password is required',
        }),
    })
        .passthrough()
        .superRefine((data, ctx) => {
        if (!data.currentPassword && !data.oldPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Current password is required',
                path: ['oldPassword'],
            });
        }
        if (data.confirmPassword && data.newPassword !== data.confirmPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passwords do not match',
                path: ['confirmPassword'],
            });
        }
    }),
});
// Claim Admin Schema
const claimAdminZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        email: zod_1.z
            .string({ error: 'Email is required' })
            .email('Invalid email address')
            .transform(val => val.toLowerCase().trim()),
        currentPassword: zod_1.z.string({
            error: 'Current password is required',
        }),
        newPassword: zod_1.z
            .string({ error: 'New password is required' })
            .min(8, 'Password must be at least 8 characters long')
            .max(128, 'Password cannot exceed 128 characters'),
        confirmPassword: zod_1.z.string().optional(),
    })
        .passthrough(),
});
exports.AuthValidation = {
    registerUserZodSchema,
    registerSchema: registerUserZodSchema,
    verifyOtpSchema,
    verifyEmailSchema: verifyOtpSchema,
    resendOtpSchema,
    resendVerificationSchema: resendOtpSchema,
    loginSchema,
    refreshTokenSchema,
    refreshSchema: refreshTokenSchema,
    forgetPasswordSchema,
    forgotPasswordSchema: forgetPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    createChangePasswordZodSchema,
    claimAdminZodSchema,
    // Backward-compatibility aliases
    createRegisterZodSchema: registerUserZodSchema,
    createVerifyEmailZodSchema: verifyOtpSchema,
    createLoginZodSchema: loginSchema,
    createRefreshTokenZodSchema: refreshTokenSchema,
    createForgetPasswordZodSchema: forgetPasswordSchema,
    createResetPasswordZodSchema: resetPasswordSchema,
    changePasswordZodSchema: changePasswordSchema,
};
//# sourceMappingURL=auth.validation.js.map