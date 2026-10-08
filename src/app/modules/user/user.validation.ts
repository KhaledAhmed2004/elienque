import { z } from 'zod';
import { CARD_PAYMENT_STATUS } from '../../../enums/user';

const phoneRegex = /^\+?[0-9]{7,15}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

const paymentMethodsSchema = z
  .union([
    z.object({
      zelle: z
        .object({
          email: z.string().email('Invalid email address').optional(),
        })
        .optional(),
      venmo: z
        .object({
          username: z.string().optional(),
        })
        .optional(),
      cashApp: z
        .object({
          cashtag: z.string().optional(),
        })
        .optional(),
      cardPayment: z
        .object({
          status: z
            .enum(Object.values(CARD_PAYMENT_STATUS) as [string, ...string[]])
            .optional(),
        })
        .optional(),
    }),
    z.string().transform(val => {
      try {
        const parsed = JSON.parse(val);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }),
  ])
  .optional();

const createUserZodSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'Name is required'),
      nickname: z.string().min(1).max(50).optional(),
      email: z.string().min(1, 'Email is required').email('Invalid email address'),
      password: z
        .string().min(1, 'Password is required')
        .regex(
          passwordRegex,
          'Password must include upper, lower, number, special and be 8+ chars',
        ),
      phone: z
        .string().min(1, 'Phone is required')
        .regex(phoneRegex, 'Phone must be 7-15 digits, optional +'),
      profilePicture: z.string().optional(),
      paymentMethods: paymentMethodsSchema,
      role: z.enum(['PROMOTER', 'BUSINESS_OWNER', 'ADMIN']).optional(),
      businessName: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.role === 'BUSINESS_OWNER' && (!data.businessName || data.businessName.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Business name is required for Business Owners',
          path: ['businessName'],
        });
      }
    }),
});

const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    nickname: z.string().max(50).optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be 7-15 digits, optional +')
      .optional(),
    experience: z.coerce.number().min(0).optional(),
    password: z
      .string()
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars',
      )
      .optional(),
    profilePicture: z.string().optional(),
    paymentMethods: paymentMethodsSchema,
    businessName: z.string().optional(),
  }),
});

const suspendUserZodSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

const blockUserZodSchema = suspendUserZodSchema;

const rejectUserZodSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

const deleteUserZodSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required for account deletion'),
  }),
});

export const UserValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  suspendUserZodSchema,
  blockUserZodSchema,
  rejectUserZodSchema,
  deleteUserZodSchema,
};
