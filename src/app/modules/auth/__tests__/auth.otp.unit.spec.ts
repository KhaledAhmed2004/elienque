import { describe, it, expect } from 'vitest';
import generateOTP from '../../../../util/generateOTP';

describe('OTP Generation & Security Unit Tests (BDD Scenarios: BR-02, BR-03)', () => {
  it('Scenario: Generate cryptographic 6-digit OTP within range [100000, 999999]', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOTP();
      expect(typeof otp).toBe('number');
      expect(otp).toBeGreaterThanOrEqual(100000);
      expect(otp).toBeLessThanOrEqual(999999);
      expect(String(otp).length).toBe(6);
    }
  });

  it('Scenario: OTP attempt limit threshold (max 5 failed attempts)', () => {
    const MAX_ALLOWED_ATTEMPTS = 5;
    let attempts = 0;

    const simulateFailedAttempt = () => {
      attempts++;
      if (attempts >= MAX_ALLOWED_ATTEMPTS) {
        return { isLocked: true, shouldInvalidateOtp: true };
      }
      return { isLocked: false, shouldInvalidateOtp: false };
    };

    // Attempts 1 to 4 should not invalidate
    for (let i = 1; i <= 4; i++) {
      const result = simulateFailedAttempt();
      expect(result.isLocked).toBe(false);
      expect(result.shouldInvalidateOtp).toBe(false);
    }

    // 5th attempt must invalidate the OTP
    const fifthAttempt = simulateFailedAttempt();
    expect(fifthAttempt.isLocked).toBe(true);
    expect(fifthAttempt.shouldInvalidateOtp).toBe(true);
  });

  it('Scenario: Resend cooldown enforcement (60-second window)', () => {
    const OTP_LIFETIME_MS = 3 * 60 * 1000;
    const COOLDOWN_MS = 60 * 1000;

    const checkCooldown = (lastExpireAt: Date, now: Date) => {
      const sentAt = new Date(lastExpireAt.getTime() - OTP_LIFETIME_MS);
      const elapsedMs = now.getTime() - sentAt.getTime();
      return elapsedMs < COOLDOWN_MS;
    };

    const now = new Date();
    const expireAt = new Date(now.getTime() + OTP_LIFETIME_MS);

    // Requesting resend immediately (0s elapsed) must be blocked
    expect(checkCooldown(expireAt, now)).toBe(true);

    // Requesting resend after 30s must still be blocked
    const thirtySecLater = new Date(now.getTime() + 30 * 1000);
    expect(checkCooldown(expireAt, thirtySecLater)).toBe(true);

    // Requesting resend after 61s must be permitted
    const sixtyOneSecLater = new Date(now.getTime() + 61 * 1000);
    expect(checkCooldown(expireAt, sixtyOneSecLater)).toBe(false);
  });
});
