"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptPayload = exports.encryptPayload = exports.verifyOtpHash = exports.hashOtp = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config"));
/**
 * Hash an OTP using HMAC-SHA256
 */
const hashOtp = (otp) => {
    return crypto_1.default
        .createHmac('sha256', config_1.default.otp_secret)
        .update(otp)
        .digest('hex');
};
exports.hashOtp = hashOtp;
/**
 * Verify an OTP against a stored hash using constant-time comparison
 */
const verifyOtpHash = (inputOtp, storedHash) => {
    const inputHash = (0, exports.hashOtp)(inputOtp);
    const inputBuffer = Buffer.from(inputHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    // To prevent timing attacks when length mismatches
    if (inputBuffer.length !== storedBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(inputBuffer, storedBuffer);
};
exports.verifyOtpHash = verifyOtpHash;
// AES encryption key derived from otp_secret
const ENCRYPTION_KEY = crypto_1.default.createHash('sha256').update(config_1.default.otp_secret).digest();
const IV_LENGTH = 16;
/**
 * Encrypt arbitrary payload for secure storage (e.g., in Outbox)
 */
const encryptPayload = (payload) => {
    const text = JSON.stringify(payload);
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};
exports.encryptPayload = encryptPayload;
/**
 * Decrypt a payload back to an object
 */
const decryptPayload = (encryptedText) => {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
};
exports.decryptPayload = decryptPayload;
//# sourceMappingURL=cryptoHelpers.js.map