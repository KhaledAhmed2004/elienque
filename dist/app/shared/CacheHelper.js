"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheHelper = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
const requestContext_1 = require("../logging/requestContext");
class CacheHelper {
    static instance;
    cache;
    constructor(options = {}) {
        this.cache = new node_cache_1.default({
            stdTTL: options.ttl || 600,
            checkperiod: options.checkperiod || 120,
            useClones: false,
        });
        logger_1.logger.info('🔹 CacheHelper initialized');
    }
    static getInstance(options) {
        if (!CacheHelper.instance) {
            CacheHelper.instance = new CacheHelper(options);
        }
        return CacheHelper.instance;
    }
    // ------------------- Basic Cache Operations -------------------
    async set(key, value, ttl) {
        const start = Date.now();
        const logPrefix = `[CACHE][SET] key:${key}`;
        try {
            const ok = this.cache.set(key, value, ttl || 0);
            logger_1.logger.info(`${logPrefix} ✅ | TTL: ${ttl || 'default'} | ⏱ ${Date.now() - start}ms`);
            return ok;
        }
        catch (err) {
            logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
            // Fallback to memory
            const ok = this.cache.set(key, value, ttl || 0);
            return ok;
        }
    }
    async get(key) {
        const start = Date.now();
        const logPrefix = `[CACHE][GET] key:${key}`;
        try {
            const res = this.cache.get(key);
            logger_1.logger.info(`${logPrefix} ${res ? 'HIT ✅' : 'MISS ⚠️'} | ⏱ ${Date.now() - start}ms`);
            const dur = Date.now() - start;
            if (res !== undefined)
                (0, requestContext_1.recordCacheHit)(dur);
            else
                (0, requestContext_1.recordCacheMiss)(dur);
            return res;
        }
        catch (err) {
            logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
            const fallback = this.cache.get(key);
            const dur = Date.now() - start;
            if (fallback !== undefined)
                (0, requestContext_1.recordCacheHit)(dur);
            else
                (0, requestContext_1.recordCacheMiss)(dur);
            return fallback;
        }
    }
    async del(key) {
        const start = Date.now();
        const keys = Array.isArray(key) ? key : [key];
        const logPrefix = `[CACHE][DEL] keys:${keys.join(',')}`;
        try {
            const res = this.cache.del(keys);
            logger_1.logger.info(`${logPrefix} ✅ | ⏱ ${Date.now() - start}ms`);
            return res;
        }
        catch (err) {
            logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
            return this.cache.del(keys);
        }
    }
    async has(key) {
        const start = Date.now();
        const logPrefix = `[CACHE][HAS] key:${key}`;
        try {
            const res = this.cache.has(key);
            logger_1.logger.info(`${logPrefix} ${res ? 'YES ✅' : 'NO ⚠️'} | ⏱ ${Date.now() - start}ms`);
            return res;
        }
        catch (err) {
            logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
            return this.cache.has(key);
        }
    }
    async flush() {
        const start = Date.now();
        const logPrefix = `[CACHE][FLUSH]`;
        try {
        }
        catch (err) {
            logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
        }
        this.cache.flushAll();
        logger_1.logger.info(`${logPrefix} ✅ | ⏱ ${Date.now() - start}ms`);
    }
    // ------------------- Advanced Operations -------------------
    async getOrSet(key, fetchFunction, ttl) {
        const start = Date.now();
        const cached = await this.get(key);
        if (cached !== undefined)
            return cached;
        const fresh = await fetchFunction();
        await this.set(key, fresh, ttl);
        logger_1.logger.info(`[CACHE][GETORSET] key:${key} ✅ (fresh) | ⏱ ${Date.now() - start}ms`);
        return fresh;
    }
    async setWithTags(key, value, tags, ttl) {
        const success = await this.set(key, value, ttl);
        if (success) {
            for (const tag of tags) {
                const tagKey = `tag:${tag}`;
                const existing = (await this.get(tagKey)) || [];
                if (!existing.includes(key)) {
                    existing.push(key);
                    await this.set(tagKey, existing);
                }
            }
        }
        return success;
    }
    async invalidateByTag(tag) {
        const tagKey = `tag:${tag}`;
        const taggedKeys = (await this.get(tagKey)) || [];
        const deletedCount = await this.del(taggedKeys);
        await this.del(tagKey);
        logger_1.logger.info(`[CACHE][INVALIDATE TAG] tag:${tag} deleted:${deletedCount}`);
        return deletedCount;
    }
    // ------------------- Utility -------------------
    getStats() {
        return this.cache.getStats();
    }
    getKeys() {
        return this.cache.keys();
    }
    generateCacheKey(...parts) {
        return parts.join(':');
    }
}
exports.CacheHelper = CacheHelper;
//# sourceMappingURL=CacheHelper.js.map