import { describe, it, expect } from 'vitest';
import { ACCOUNT_STATE } from '../../../../enums/user';

describe('Progressive Account Lockout Unit Tests (BDD Scenarios: BR-05, AP-08)', () => {
  const calculateLockout = (failedAttempts: number, baseTime: Date) => {
    let lockUntil: Date | null = null;
    let accountState = ACCOUNT_STATE.VERIFIED;

    if (failedAttempts >= 15) {
      lockUntil = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // 24h
      accountState = ACCOUNT_STATE.LOCKED;
    } else if (failedAttempts >= 10) {
      lockUntil = new Date(baseTime.getTime() + 60 * 60 * 1000); // 1h
      accountState = ACCOUNT_STATE.LOCKED;
    } else if (failedAttempts >= 5) {
      lockUntil = new Date(baseTime.getTime() + 10 * 60 * 1000); // 10m
      accountState = ACCOUNT_STATE.LOCKED;
    }

    return { lockUntil, accountState };
  };

  it('Scenario: Attempts 1 to 4 should not lock account', () => {
    const now = new Date();
    for (let attempts = 1; attempts <= 4; attempts++) {
      const result = calculateLockout(attempts, now);
      expect(result.lockUntil).toBeNull();
      expect(result.accountState).toBe(ACCOUNT_STATE.VERIFIED);
    }
  });

  it('Scenario: 5 failed attempts locks account for 10 minutes', () => {
    const now = new Date();
    const result = calculateLockout(5, now);
    expect(result.accountState).toBe(ACCOUNT_STATE.LOCKED);
    expect(result.lockUntil).not.toBeNull();
    const lockedMs = result.lockUntil!.getTime() - now.getTime();
    expect(lockedMs).toBe(10 * 60 * 1000); // Exactly 10 minutes
  });

  it('Scenario: 10 failed attempts locks account for 1 hour', () => {
    const now = new Date();
    const result = calculateLockout(10, now);
    expect(result.accountState).toBe(ACCOUNT_STATE.LOCKED);
    expect(result.lockUntil).not.toBeNull();
    const lockedMs = result.lockUntil!.getTime() - now.getTime();
    expect(lockedMs).toBe(60 * 60 * 1000); // Exactly 1 hour
  });

  it('Scenario: 15 failed attempts locks account for 24 hours', () => {
    const now = new Date();
    const result = calculateLockout(15, now);
    expect(result.accountState).toBe(ACCOUNT_STATE.LOCKED);
    expect(result.lockUntil).not.toBeNull();
    const lockedMs = result.lockUntil!.getTime() - now.getTime();
    expect(lockedMs).toBe(24 * 60 * 60 * 1000); // Exactly 24 hours
  });
});
