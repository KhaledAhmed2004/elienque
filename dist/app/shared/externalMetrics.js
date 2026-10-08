"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackExternal = trackExternal;
exports.recordExternal = recordExternal;
const requestContext_1 = require("../logging/requestContext");
const logger_1 = require("../../shared/logger");
async function trackExternal(label, fn) {
    const start = Date.now();
    try {
        const res = await fn();
        const dur = Date.now() - start;
        (0, requestContext_1.recordExternalCall)(dur);
        logger_1.logger.info(`[EXTERNAL] ${label} ✅ | ⏱ ${dur}ms`);
        return res;
    }
    catch (err) {
        const dur = Date.now() - start;
        (0, requestContext_1.recordExternalCall)(dur);
        logger_1.errorLogger.error(`[EXTERNAL] ${label} ❌ | ⏱ ${dur}ms | ${err?.message || 'unknown error'}`);
        throw err;
    }
}
function recordExternal(durationMs, label) {
    (0, requestContext_1.recordExternalCall)(durationMs);
    if (label)
        logger_1.logger.info(`[EXTERNAL] ${label} ⏱ ${durationMs}ms`);
}
//# sourceMappingURL=externalMetrics.js.map