"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fastest_levenshtein_1 = require("fastest-levenshtein");
// Clean the path (always returns string)
const cleanPath = (pathArray) => pathArray.join('.').replace(/^body\./, '');
const handleZodError = (error) => {
    const allErrorMessages = [];
    const missingFields = [];
    const coveredFields = [];
    // Collect expected fields for suggestions
    const expectedFields = Array.from(new Set((error.issues || error.errors || [])
        .flatMap((issue) => {
        if (issue.code === 'invalid_type' && issue.path && issue.path.length > 0) {
            const field = issue.path[issue.path.length - 1];
            return field ? [String(field)] : [];
        }
        return [];
    })
        .filter(Boolean)));
    // Single pass over all Zod issues
    (error.issues || error.errors || []).forEach((issue) => {
        switch (issue.code) {
            case 'unrecognized_keys': {
                const unrec = issue;
                (unrec.keys || []).forEach((key) => {
                    const cleanKey = key.replace(/^body\./, '');
                    const suggestion = (0, fastest_levenshtein_1.closest)(cleanKey, expectedFields);
                    if (suggestion)
                        coveredFields.push(suggestion);
                    allErrorMessages.push({
                        path: cleanKey,
                        message: suggestion
                            ? `We don't recognize '${cleanKey}'. Did you mean '${suggestion}'?`
                            : `We don't recognize '${cleanKey}'.`,
                    });
                });
                break;
            }
            case 'invalid_type': {
                const invalid = issue;
                const path = cleanPath(invalid.path);
                const received = invalid.received ??
                    (typeof invalid.message === 'string' &&
                        invalid.message.includes('received undefined')
                        ? 'undefined'
                        : (invalid.message?.match(/received\s+([a-zA-Z0-9_]+)/)?.[1] ?? undefined));
                if (received === 'undefined') {
                    // Missing field
                    missingFields.push(path);
                }
                else {
                    // Type mismatch
                    allErrorMessages.push({
                        path,
                        message: `Expected ${invalid.expected} for '${path}', but received ${received || 'invalid value'}.`,
                    });
                }
                break;
            }
            default:
                allErrorMessages.push({
                    path: cleanPath(issue.path) || 'unknown',
                    message: issue.message,
                });
                break;
        }
    });
    // Add missing fields that are not covered by typo suggestions
    missingFields.forEach(field => {
        if (!coveredFields.includes(field)) {
            allErrorMessages.push({
                path: field,
                message: `Missing required field '${field}'.`,
            });
        }
    });
    return {
        statusCode: 400,
        message: 'Validation Error',
        errorMessages: allErrorMessages,
    };
};
exports.default = handleZodError;
//# sourceMappingURL=handleZodError.js.map