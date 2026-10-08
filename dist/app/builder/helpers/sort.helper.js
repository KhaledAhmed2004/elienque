"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripSortPrefix = stripSortPrefix;
exports.parseSortTokens = parseSortTokens;
exports.buildSortString = buildSortString;
exports.buildSortObject = buildSortObject;
/* eslint-disable no-unused-vars */
// Strips '+' or '-' prefix from a sort token to reveal the plain field name.
function stripSortPrefix(field) {
    return field.startsWith('-') || field.startsWith('+')
        ? field.substring(1)
        : field;
}
// Parses a comma-separated sort string into clean, safe tokens.
function parseSortTokens(rawSort, isDangerousKey, allowedFields) {
    return rawSort
        .split(',')
        .map(s => s.trim())
        .filter(s => {
        if (!s || isDangerousKey(s))
            return false;
        if (allowedFields && allowedFields.length > 0) {
            return allowedFields.includes(stripSortPrefix(s));
        }
        return true;
    });
}
// Generates a space-separated sort string compatible with Mongoose Query.prototype.sort().
function buildSortString(rawSort, defaultSort = '-createdAt', isDangerousKey, allowedFields) {
    if (!rawSort)
        return defaultSort;
    const tokens = parseSortTokens(rawSort, isDangerousKey, allowedFields);
    return tokens.length > 0 ? tokens.join(' ') : defaultSort;
}
// Generates a MongoDB aggregation $sort specification object ({ field: 1 | -1 }).
function buildSortObject(rawSort, isDangerousKey, defaultSortObj = { createdAt: -1 }) {
    if (!rawSort)
        return defaultSortObj;
    const sortParams = {};
    const tokens = rawSort.split(',').map(s => s.trim());
    for (const token of tokens) {
        if (!token || isDangerousKey(token))
            continue;
        if (token.startsWith('-')) {
            const field = token.substring(1);
            if (field && !isDangerousKey(field)) {
                sortParams[field] = -1;
            }
        }
        else {
            const field = token.startsWith('+') ? token.substring(1) : token;
            if (field && !isDangerousKey(field)) {
                sortParams[field] = 1;
            }
        }
    }
    return Object.keys(sortParams).length > 0 ? sortParams : defaultSortObj;
}
//# sourceMappingURL=sort.helper.js.map