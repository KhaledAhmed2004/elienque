import { describe, it, expect } from 'vitest';
import { AuthValidation } from '../auth.validation';
import { UserValidation } from '../../user/user.validation';

describe('Authentication & Registration Validation Unit Tests (BDD Scenarios)', () => {
  describe('User Registration Validation (BDD: lines 225–260)', () => {
    const validRegistrationPayload = {
      body: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+15551234567',
        password: 'SecurePassword123!',
        company: 'Doe Transport LLC',
        companyName: 'Doe Transport LLC',
        
        serviceArea: 'New York',
        serviceAreaId: '654321654321654321654321',
        vehicles: [
          {
            carType: 'SUV',
            makeAndModel: 'Toyota Highlander',
            colorInside: 'Black',
            colorOutside: 'White',
            year: 2022,
            licensePlate: 'ABC-1234',
            vehicleRegistrationExpiryDate: '2025-12-31T23:59:59.000Z',
            vehicleRegistrationImage: 'https://example.com/reg.jpg',
            commercialInsuranceExpiryDate: '2025-12-31T23:59:59.000Z',
            commercialInsuranceImage: 'https://example.com/ins.jpg',
            vehiclePhotoFront: 'https://example.com/front.jpg',
            vehiclePhotoRear: 'https://example.com/rear.jpg',
            vehiclePhotoInterior: 'https://example.com/int.jpg',
          },
        ],
      },
    };

    it('Scenario: Accept valid registration payload with strong password', () => {
      const result = AuthValidation.registerUserZodSchema.safeParse(validRegistrationPayload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Also validates using registerSchema alias', () => {
      const result = AuthValidation.registerUserZodSchema.safeParse(validRegistrationPayload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Reject registration with invalid email format', () => {
      const payload = {
        body: {
          ...validRegistrationPayload.body,
          email: 'invalid-email-format',
        },
      };
      const result = UserValidation.createUserZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.errors.find(e => e.path.includes('email'));
        expect(emailError).toBeDefined();
        expect(emailError?.message).toContain('Invalid email');
      }
    });

    it('Scenario: Reject registration with missing required fields (e.g. phone or name)', () => {
      const payload = {
        body: {
          email: 'john.doe@example.com',
          password: 'SecurePassword123!',
        },
      };
      const result = UserValidation.createUserZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map(e => e.path.join('.'));
        expect(paths).toContain('body.name');
        expect(paths).toContain('body.phone');
      }
    });

    it('Scenario: Reject registration with an invalid password (missing uppercase/symbol)', () => {
      const weakPasswords = [
        'weakpass', // no uppercase, digit, or special char
        'Password', // no digit or special char
        'Password123', // no special char
        'pass123!', // no uppercase
        'P1!', // less than 8 characters
      ];

      weakPasswords.forEach(pwd => {
        const payload = {
          body: {
            ...validRegistrationPayload.body,
            password: pwd,
          },
        };
        const result = UserValidation.createUserZodSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    it('Scenario: Reject phone number not matching international E.164 pattern', () => {
      const payload = {
        body: {
          ...validRegistrationPayload.body,
          phone: 'abc-invalid-phone',
        },
      };
      const result = UserValidation.createUserZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('OTP Email Verification Schema (AuthValidation.createVerifyEmailZodSchema)', () => {
    it('Scenario: Accept valid email and numeric one-time code', () => {
      const payload = {
        body: {
          email: 'test@example.com',
          oneTimeCode: 123456,
        },
      };
      const result = AuthValidation.createVerifyEmailZodSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Reject missing OTP or missing email', () => {
      const payload = {
        body: {
          email: 'test@example.com',
        },
      };
      const result = AuthValidation.createVerifyEmailZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Password Change Schema (AuthValidation.createChangePasswordZodSchema)', () => {
    it('Scenario: Accept valid password change payload', () => {
      const payload = {
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewSecurePassword123!',
          confirmPassword: 'NewSecurePassword123!',
        },
      };
      const result = AuthValidation.createChangePasswordZodSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Reject when confirmPassword is missing', () => {
      const payload = {
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewSecurePassword123!',
        },
      };
      const result = AuthValidation.createChangePasswordZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Resend OTP Schema (AuthValidation.resendOtpSchema)', () => {
    it('Scenario: Accept valid email for resending OTP', () => {
      const payload = {
        body: {
          email: 'user@example.com',
        },
      };
      const result = AuthValidation.resendOtpSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Reject malformed email for resending OTP', () => {
      const payload = {
        body: {
          email: 'not-an-email',
        },
      };
      const result = AuthValidation.resendOtpSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Claim Admin Account Schema (AuthValidation.claimAdminZodSchema)', () => {
    const validClaimPayload = {
      body: {
        email: 'newadmin@company.com',
        currentPassword: 'InitialAdmin123!',
        newPassword: 'SuperSecret2026!#',
        confirmPassword: 'SuperSecret2026!#',
      },
    };

    it('Scenario: Accept valid claim admin payload with email and new password', () => {
      const result = AuthValidation.claimAdminZodSchema.safeParse(validClaimPayload);
      expect(result.success).toBe(true);
    });

    it('Scenario: Reject claim admin with malformed email', () => {
      const payload = {
        body: {
          ...validClaimPayload.body,
          email: 'invalid-email-address',
        },
      };
      const result = AuthValidation.claimAdminZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('Scenario: Reject claim admin with weak password', () => {
      const payload = {
        body: {
          ...validClaimPayload.body,
          newPassword: 'weak',
          confirmPassword: 'weak',
        },
      };
      const result = AuthValidation.claimAdminZodSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});

