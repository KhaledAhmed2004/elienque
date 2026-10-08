"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLockoutState = exports.RESET_TOKEN_EXPIRY_MS = exports.OTP_MAX_ATTEMPTS = exports.OTP_EXPIRY_MS = exports.OTP_COOLDOWN_MS = void 0;
exports.OTP_COOLDOWN_MS = 60 * 1000;
exports.OTP_EXPIRY_MS = 10 * 60 * 1000;
exports.OTP_MAX_ATTEMPTS = 5;
exports.RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const calculateLockoutState = (attempts) => {
    if (attempts >= exports.OTP_MAX_ATTEMPTS) {
        return { lockUntil: new Date(Date.now() + 15 * 60 * 1000), isLocked: true };
    }
    return { lockUntil: null, isLocked: false };
};
exports.calculateLockoutState = calculateLockoutState;
//# sourceMappingURL=auth.constant.js.map