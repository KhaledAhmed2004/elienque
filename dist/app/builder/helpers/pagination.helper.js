"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = void 0;
exports.extractNumber = extractNumber;
exports.extractPaginationParams = extractPaginationParams;
exports.calculateTotalPages = calculateTotalPages;
exports.DEFAULT_PAGE = 1;
exports.DEFAULT_LIMIT = 10;
exports.MAX_LIMIT = 100;
// Extracts a numeric value safely from a query record.
function extractNumber(query, key, defaultValue, options = {}) {
    const val = query[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
        return options.integer ? Math.floor(val) : val;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed ||
            trimmed === 'NaN' ||
            trimmed === 'Infinity' ||
            trimmed === '-Infinity') {
            return defaultValue;
        }
        const parsed = parseFloat(trimmed);
        if (Number.isFinite(parsed)) {
            return options.integer ? Math.floor(parsed) : parsed;
        }
    }
    return defaultValue;
}
// Pure function: Extracts and normalizes page, limit, and skip parameters.
function extractPaginationParams(query, defaultLimit = exports.DEFAULT_LIMIT, maxLimit = exports.MAX_LIMIT, defaultPage = exports.DEFAULT_PAGE) {
    const rawLimit = extractNumber(query, 'limit', defaultLimit, { integer: true }) ??
        defaultLimit;
    const limit = Math.min(Math.max(1, rawLimit), maxLimit);
    const rawPage = extractNumber(query, 'page', defaultPage, { integer: true }) ?? defaultPage;
    const page = Math.max(1, rawPage);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
// Pure function: Calculates total pages safely.
function calculateTotalPages(total, limit) {
    return Math.ceil(total / Math.max(1, limit));
}
//# sourceMappingURL=pagination.helper.js.map