"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = exports.memory = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
exports.memory = new node_cache_1.default({ stdTTL: 60, checkperiod: 30 });
const rateLimitMiddleware = (options) => {
    const { windowMs, max, keyResolver, routeName } = options;
    return async (req, res, next) => {
        const identifier = keyResolver ? keyResolver(req) : req.ip;
        // If keyResolver is provided but returns undefined/null (e.g. missing email/phone), skip rate limit
        if (keyResolver && !identifier) {
            return next();
        }
        const key = `ratelimit:${routeName || req.path}:${identifier}`;
        try {
            // In-memory counter
            const current = (exports.memory.get(key) || 0) + 1;
            exports.memory.set(key, current, Math.ceil(windowMs / 1000));
            if (current > max) {
                logger_1.logger.warn(`⚠️ Rate limit exceeded for IP/ID: ${identifier} on route: ${routeName || req.path}`);
                // Add Retry-After header
                const ttl = exports.memory.getTtl(key) || Date.now();
                const retryAfterSeconds = Math.ceil((ttl - Date.now()) / 1000);
                res.setHeader('Retry-After', Math.max(0, retryAfterSeconds));
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests, please try again later',
                });
            }
            logger_1.logger.info(`✅ RateLimit applied for ID: ${identifier}`);
            return next();
        }
        catch (e) {
            // On any error, allow request but log
            logger_1.logger.warn(`⚠️ RateLimit error: ${e.message}`);
            return next();
        }
    };
};
exports.rateLimitMiddleware = rateLimitMiddleware;
//# sourceMappingURL=rateLimit.js.map