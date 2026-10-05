import { z } from 'zod';
import { COMPANY_ROLE } from '../../../enums/user';

const phoneRegex = /^\+?[0-9]{7,15}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

// 2.1 Register Schema
const registerUserZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(1),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars',
      )
      .max(128, 'Password cannot exceed 128 characters'),
    phone: z
      .string({ required_error: 'Phone is required' })
      .regex(phoneRegex, 'Phone must be 7-15 digits, optional +'),
    serviceAreaId: z
      .string({ required_error: 'Service area ID is required' })
      .min(1),
    companyName: z
      .string({ required_error: 'Company name is required' })
      .min(1),
    companyRole: z.enum(Object.values(COMPANY_ROLE) as [string, ...string[]], {
      required_error: 'Company role is required',
    }),
  }),
});

// 2.2 Verify OTP
const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    oneTimeCode: z.number({ required_error: 'One time code is required' }),
  }),
});

// 2.3 Resend OTP
const resendOtpSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
  }),
});

// 2.4 Login
const loginSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

// 2.5 Refresh Token
const refreshTokenSchema = z.object({
  // Allow empty body when using cookie-based refresh tokens
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

// Additional Password Management
const forgetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string({ required_error: 'Password is required' }),
    confirmPassword: z.string({
      required_error: 'Confirm Password is required',
    }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string({ required_error: 'New Password is required' }),
    confirmPassword: z.string({
      required_error: 'Confirm Password is required',
    }),
  }),
});

const claimAdminZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    currentPassword: z.string({
      required_error: 'Current password is required',
    }),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars',
      )
      .max(128, 'Password cannot exceed 128 characters'),
    confirmPassword: z.string({
      required_error: 'Confirm password is required',
    }),
  }),
});

export const AuthValidation = {
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

// Inferred Types for Controller and Service usage
export type IRegisterUserReq = z.infer<typeof registerUserZodSchema>['body'];
export type IVerifyOtpReq = z.infer<typeof verifyOtpSchema>['body'];
export type IResendOtpReq = z.infer<typeof resendOtpSchema>['body'];
export type ILoginReq = z.infer<typeof loginSchema>['body'];
// Handle optional body for refresh token
export type IRefreshTokenReq = NonNullable<
  z.infer<typeof refreshTokenSchema>
>['body'];
export type IForgetPasswordReq = z.infer<typeof forgetPasswordSchema>['body'];
export type IResetPasswordReq = z.infer<typeof resetPasswordSchema>['body'];
export type IChangePasswordReq = z.infer<typeof changePasswordSchema>['body'];
export type IClaimAdminReq = z.infer<typeof claimAdminZodSchema>['body'];
