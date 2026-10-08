"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorQueryBuilder = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
/**
 * Enterprise-grade Cursor-based MongoDB / Mongoose Query Builder.
 * Standardizes opaque Base64URL tokens, ReDoS-safe search, lookahead slicing,
 * and high-performance infinite scroll / dropdown options queries.
 */
class CursorQueryBuilder {
    modelQuery;
    query;
    limit;
    cursorField;
    order;
    extraConditions = [];
    projection;
    population;
    constructor(modelQuery, query = {}, options = {}) {
        this.modelQuery = modelQuery;
        this.query = query || {};
        const defaultLimit = options.defaultLimit ?? 10;
        const maxLimit = options.maxLimit ?? 50;
        const parsedLimit = Math.floor(Number(this.query.limit));
        this.limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit, maxLimit);
        this.cursorField = options.cursorField ?? '_id';
        this.order = options.order ?? 'asc';
    }
    // ==========================================
    // 🛡️ SAFE TYPE CONVERSION HELPERS (PRIVATE)
    // ==========================================
    isDangerousKey(key) {
        if (!key || typeof key !== 'string')
            return true;
        const lower = key.toLowerCase();
        return (lower.includes('__proto__') ||
            lower.includes('constructor') ||
            lower.includes('prototype') ||
            lower.includes('$'));
    }
    getNumber(key) {
        const val = this.query[key];
        if (typeof val === 'number' && Number.isFinite(val)) {
            return val;
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (!trimmed || trimmed === 'NaN' || trimmed === 'Infinity' || trimmed === '-Infinity') {
                return undefined;
            }
            const parsed = parseFloat(trimmed);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return undefined;
    }
    /**
     * Configure cursor sorting field and order ('asc' | 'desc')
     */
    cursor(field = '_id', order = 'asc') {
        this.cursorField = field;
        this.order = order;
        return this;
    }
    /**
     * Search across multiple string fields using sanitized regex
     */
    search(searchableFields, maxSearchLength = 256) {
        const rawSearch = this.query.searchTerm;
        if (typeof rawSearch === 'string' &&
            rawSearch.trim().length > 0 &&
            searchableFields.length > 0) {
            let term = rawSearch.trim();
            if (term.length > maxSearchLength) {
                term = term.substring(0, maxSearchLength);
            }
            const sanitizedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const orConditions = searchableFields.map((field) => ({
                [field]: { $regex: sanitizedTerm, $options: 'i' },
            }));
            this.extraConditions.push({ $or: orConditions });
        }
        return this;
    }
    /**
     * Numeric range filter (e.g. minPrice/maxPrice, minSalary/maxSalary)
     */
    range(dbField, minQueryKey, maxQueryKey) {
        const capitalized = dbField.charAt(0).toUpperCase() + dbField.slice(1);
        const minKey = minQueryKey || `min${capitalized}`;
        const maxKey = maxQueryKey || `max${capitalized}`;
        const min = this.getNumber(minKey);
        const max = this.getNumber(maxKey);
        const rangeCriteria = {};
        if (min !== undefined)
            rangeCriteria.$gte = min;
        if (max !== undefined)
            rangeCriteria.$lte = max;
        if (Object.keys(rangeCriteria).length > 0) {
            this.extraConditions.push({ [dbField]: rangeCriteria });
        }
        return this;
    }
    /**
     * Add custom filter conditions (safely ignores undefined and empty string values)
     */
    filter(filterCondition) {
        if (filterCondition && typeof filterCondition === 'object') {
            const cleanFilter = {};
            for (const [key, value] of Object.entries(filterCondition)) {
                if (!this.isDangerousKey(key) && value !== undefined && value !== '') {
                    cleanFilter[key] = value;
                }
            }
            if (Object.keys(cleanFilter).length > 0) {
                this.extraConditions.push(cleanFilter);
            }
        }
        return this;
    }
    /**
     * Field projection / Selection
     * Supports: .select(), .fields(), .only(), .pick(), .project()
     */
    select(fields) {
        this.projection = Array.isArray(fields) ? fields.join(' ') : fields;
        return this;
    }
    /**
     * Meaningful alias: .fields(['_id', 'areaName']) or .fields('_id areaName')
     */
    fields(fields) {
        return this.select(fields);
    }
    /**
     * Meaningful alias: .only(['_id', 'areaName']) - fetch ONLY these specified fields
     */
    only(fields) {
        return this.select(fields);
    }
    /**
     * Meaningful alias: .pick(['_id', 'areaName'])
     */
    pick(fields) {
        return this.select(fields);
    }
    /**
     * Meaningful alias: .project('_id areaName')
     */
    project(fields) {
        return this.select(fields);
    }
    /**
     * Population
     */
    populate(pop) {
        if (!this.population) {
            this.population = [];
        }
        if (Array.isArray(pop)) {
            this.population.push(...pop);
        }
        else {
            this.population.push(pop);
        }
        return this;
    }
    /**
     * Decodes and validates base64url cursor token
     */
    parseCursor() {
        const rawCursor = this.query.cursor;
        if (!rawCursor || typeof rawCursor !== 'string' || rawCursor.trim() === '') {
            return null;
        }
        let parsed;
        try {
            const decodedStr = Buffer.from(rawCursor, 'base64url').toString('utf8');
            parsed = JSON.parse(decodedStr);
        }
        catch {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor token');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor token');
        }
        // Validate ID if primary cursor is _id or compound with _id
        if (parsed._id !== undefined) {
            if (typeof parsed._id !== 'string' || !mongoose_1.Types.ObjectId.isValid(parsed._id)) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor token');
            }
        }
        if (this.cursorField !== '_id' && parsed[this.cursorField] === undefined) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid cursor token');
        }
        return parsed;
    }
    /**
     * Executes the cursor pagination query and returns structured cursor result
     */
    async execute() {
        const cursorData = this.parseCursor();
        if (cursorData) {
            if (this.cursorField === '_id') {
                const cursorId = new mongoose_1.Types.ObjectId(cursorData._id);
                const op = this.order === 'asc' ? '$gt' : '$lt';
                this.extraConditions.push({ _id: { [op]: cursorId } });
            }
            else {
                // Compound cursor support (e.g. createdAt and _id)
                const sortValue = cursorData[this.cursorField];
                const cursorId = cursorData._id
                    ? new mongoose_1.Types.ObjectId(cursorData._id)
                    : undefined;
                const compOp = this.order === 'asc' ? '$gt' : '$lt';
                if (cursorId) {
                    this.extraConditions.push({
                        $or: [
                            { [this.cursorField]: { [compOp]: sortValue } },
                            {
                                [this.cursorField]: sortValue,
                                _id: { [compOp]: cursorId },
                            },
                        ],
                    });
                }
                else {
                    this.extraConditions.push({
                        [this.cursorField]: { [compOp]: sortValue },
                    });
                }
            }
        }
        if (this.extraConditions.length > 0) {
            this.modelQuery.and(this.extraConditions);
        }
        // Sort order
        const sortObj = {};
        const dirNum = this.order === 'asc' ? 1 : -1;
        sortObj[this.cursorField] = dirNum;
        if (this.cursorField !== '_id') {
            sortObj['_id'] = dirNum;
        }
        this.modelQuery.sort(sortObj);
        // Limit + 1 for lookahead check
        this.modelQuery.limit(this.limit + 1);
        let internalProjection = this.projection;
        let hasExplicitIdExclusion = false;
        let shouldStripCursorField = false;
        if (this.projection) {
            const tokens = this.projection.split(/\s+/).filter(Boolean);
            const hasInclusion = tokens.some((t) => !t.startsWith('-'));
            hasExplicitIdExclusion = tokens.includes('-_id');
            const userRequestedCursorField = tokens.some((t) => t === this.cursorField || t === `+${this.cursorField}`);
            if (hasInclusion) {
                // Build internal projection that guarantees cursor fields are retrieved
                const internalTokens = tokens.filter((t) => t !== '-_id');
                if (this.cursorField !== '_id' && !userRequestedCursorField) {
                    internalTokens.push(this.cursorField);
                    shouldStripCursorField = true;
                }
                internalProjection = internalTokens.join(' ');
            }
            else {
                // Exclusion projection (e.g. -password -secret)
                const internalTokens = tokens.filter((t) => t !== '-_id' && t !== `-${this.cursorField}`);
                internalProjection = internalTokens.join(' ');
            }
        }
        if (internalProjection) {
            this.modelQuery.select(internalProjection);
        }
        if (this.population && this.population.length > 0) {
            this.population.forEach((p) => this.modelQuery.populate(p));
        }
        const docs = await this.modelQuery.lean().exec();
        const hasMore = docs.length > this.limit;
        const rawItems = (hasMore ? docs.slice(0, this.limit) : docs);
        let nextCursor = null;
        if (hasMore && rawItems.length > 0) {
            const lastItem = rawItems[rawItems.length - 1];
            const cursorPayload = {
                _id: lastItem._id?.toString(),
            };
            if (this.cursorField !== '_id') {
                cursorPayload[this.cursorField] = lastItem[this.cursorField];
            }
            nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64url');
        }
        // Sanitize response items to strictly preserve caller's external projection contract
        const items = rawItems.map((item) => {
            const doc = { ...item };
            if (hasExplicitIdExclusion) {
                delete doc._id;
            }
            if (shouldStripCursorField) {
                delete doc[this.cursorField];
            }
            return doc;
        });
        return {
            cursor: {
                nextCursor,
                hasMore,
                limit: this.limit,
            },
            data: items,
        };
    }
}
exports.CursorQueryBuilder = CursorQueryBuilder;
exports.default = CursorQueryBuilder;
//# sourceMappingURL=CursorQueryBuilder.js.map