import { z } from 'zod';
import { CARD_PAYMENT_STATUS, COMPANY_ROLE } from '../../../enums/user';

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

// For form-data: image comes from fileHandler (mapped in controller), so only expiryDate at validation time
const licenseDocSchemaFormData = z.object({
  image: z.string().optional(),
  expiryDate: z.string(),
});

const vehiclePhotosSchema = z.object({
  frontView: z.string().optional(),
  rearView: z.string().optional(),
  interiorView: z.string().optional(),
});

const vehicleSchema = z.object({
  carType: z.string().min(1),
  makeAndModel: z.string().min(1),
  colorInside: z.string().min(1),
  colorOutside: z.string().min(1),
  year: z.coerce.number().min(1900).max(2100),
  licensePlate: z.string().min(1),
  vehicleRegistration: licenseDocSchemaFormData.optional(),
  commercialInsurance: licenseDocSchemaFormData.optional(),
  photos: vehiclePhotosSchema.optional(),
  // form-data file field names (controller maps these into nested docs)
  vehicleRegistrationImage: z.string({ required_error: 'Vehicle registration image is required' }).min(1),
  vehicleRegistrationExpiryDate: z.string({ required_error: 'Vehicle registration expiry date is required' }).min(1),
  commercialInsuranceImage: z.string({ required_error: 'Commercial insurance image is required' }).min(1),
  commercialInsuranceExpiryDate: z.string({ required_error: 'Commercial insurance expiry date is required' }).min(1),
  vehiclePhotoFront: z.string({ required_error: 'Vehicle front photo is required' }).min(1),
  vehiclePhotoRear: z.string({ required_error: 'Vehicle rear photo is required' }).min(1),
  vehiclePhotoInterior: z.string({ required_error: 'Vehicle interior photo is required' }).min(1),
});

const createUserZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(1),
    nickname: z.string().min(1).max(50).optional(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars',
      ),
    phone: z
      .string({ required_error: 'Phone is required' })
      .regex(phoneRegex, 'Phone must be 7-15 digits, optional +'),
    serviceArea: z
      .string({ required_error: 'Service area is required' })
      .min(1),
    company: z.string({ required_error: 'Company is required' }).min(1),
    companyRole: z.enum(Object.values(COMPANY_ROLE) as [string, ...string[]], {
      required_error: 'Company role is required',
    }),
    profilePicture: z.string().optional(),
    vehicles: z.union(
      [
        z.array(vehicleSchema).min(1, 'At least one vehicle is required'),
        z.string().refine(val => {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return false;
          }
        }, 'At least one vehicle is required (valid JSON array)'),
      ],
      { required_error: 'Vehicle information is required' },
    ),
    drivingLicense: licenseDocSchemaFormData.optional(),
    hackLicense: licenseDocSchemaFormData.optional(),
    localPermit: licenseDocSchemaFormData.optional(),
    paymentMethods: paymentMethodsSchema,
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
    serviceArea: z.string().optional(),
    experience: z.coerce.number().min(0).optional(),
    company: z.string().optional(),
    companyRole: z
      .enum(Object.values(COMPANY_ROLE) as [string, ...string[]])
      .optional(),
    password: z
      .string()
      .regex(
        passwordRegex,
        'Password must include upper, lower, number, special and be 8+ chars',
      )
      .optional(),
    profilePicture: z.string().optional(),
    selectedVehicle: z.string().optional(),
    drivingLicense: licenseDocSchemaFormData.optional(),
    hackLicense: licenseDocSchemaFormData.optional(),
    localPermit: licenseDocSchemaFormData.optional(),
    paymentMethods: paymentMethodsSchema,
    // vehicle basic fields (flat — controller maps to target vehicle via vehicleId)
    // removed vehicle fields for update profile
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
    password: z.string({
      required_error: 'Password is required for account deletion',
    }),
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
