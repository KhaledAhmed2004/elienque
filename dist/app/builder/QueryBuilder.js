"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const requestContext_1 = require("../logging/requestContext");
const date_fns_1 = require("date-fns");
const pagination_helper_1 = require("./helpers/pagination.helper");
Object.defineProperty(exports, "DEFAULT_PAGE", { enumerable: true, get: function () { return pagination_helper_1.DEFAULT_PAGE; } });
Object.defineProperty(exports, "DEFAULT_LIMIT", { enumerable: true, get: function () { return pagination_helper_1.DEFAULT_LIMIT; } });
Object.defineProperty(exports, "MAX_LIMIT", { enumerable: true, get: function () { return pagination_helper_1.MAX_LIMIT; } });
const geo_helper_1 = require("./helpers/geo.helper");
const sort_helper_1 = require("./helpers/sort.helper");
// Escapes regex special characters safely without introducing PCRE2-incompatible Unicode escapes.
const escapeMongoRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
// Generic, enterprise-grade MongoDB / Mongoose Query Builder.
// Provides safe filtering, searching, sorting, pagination, geospatial queries, and population.
class QueryBuilder {
    modelQuery;
    query;
    isPaginated = false;
    constructor(modelQuery, query = {}) {
        this.modelQuery = modelQuery;
        this.query = query || {};
    }
    getSession() {
        return typeof this.modelQuery.getOptions === 'function'
            ? this.modelQuery.getOptions()?.session
            : undefined;
    }
    getModelName() {
        const model = this.modelQuery.model;
        return model?.modelName || model?.collection?.name || 'UnknownModel';
    }
    validateCoordinates(lat, lng) {
        (0, geo_helper_1.validateCoordinates)(lat, lng);
    }
    stripFieldPrefix(field) {
        return (0, sort_helper_1.stripSortPrefix)(field);
    }
    extractPaginationParams() {
        return (0, pagination_helper_1.extractPaginationParams)(this.query, pagination_helper_1.DEFAULT_LIMIT, pagination_helper_1.MAX_LIMIT, pagination_helper_1.DEFAULT_PAGE);
    }
    isDangerousKey(key) {
        if (!key || typeof key !== 'string')
            return true;
        const lower = key.toLowerCase();
        return (lower.includes('__proto__') ||
            lower.includes('constructor') ||
            lower.includes('prototype') ||
            lower.includes('$'));
    }
    getString(key, defaultValue) {
        const val = this.query[key];
        if (typeof val === 'string') {
            const trimmed = val.trim();
            return trimmed.length > 0 ? trimmed : defaultValue;
        }
        if (Array.isArray(val) && typeof val[0] === 'string') {
            const trimmed = val[0].trim();
            return trimmed.length > 0 ? trimmed : defaultValue;
        }
        return defaultValue;
    }
    getArray(key) {
        const val = this.query[key];
        if (!val)
            return [];
        if (Array.isArray(val)) {
            return val
                .map(v => (typeof v === 'string' ? v.trim() : String(v).trim()))
                .filter(v => v.length > 0 && !this.isDangerousKey(v));
        }
        if (typeof val === 'string') {
            return val
                .split(',')
                .map(v => v.trim())
                .filter(v => v.length > 0 && !this.isDangerousKey(v));
        }
        return [];
    }
    getNumber(key, defaultValue, options = {}) {
        return (0, pagination_helper_1.extractNumber)(this.query, key, defaultValue, options);
    }
    // Sanitizes object keys to prevent NoSQL query operator injection and Prototype Pollution
    // Depth is capped to prevent stack exhaustion on deeply nested payloads.
    sanitizeFilterValue(value, depth = 0, maxDepth = 5) {
        if (value === null || value === undefined)
            return value;
        if (typeof value !== 'object')
            return value;
        if (depth >= maxDepth)
            return undefined;
        if (Array.isArray(value)) {
            return value
                .map(v => this.sanitizeFilterValue(v, depth + 1, maxDepth))
                .filter(v => v !== undefined);
        }
        const sanitized = {};
        for (const [k, v] of Object.entries(value)) {
            if (this.isDangerousKey(k)) {
                continue;
            }
            const sanitizedVal = this.sanitizeFilterValue(v, depth + 1, maxDepth);
            if (sanitizedVal !== undefined) {
                sanitized[k] = sanitizedVal;
            }
        }
        return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    }
    // Search across multiple string fields using sanitized regex
    // Caps searchTerm length to maxSearchLength to prevent memory bloat/ReDoS
    search(searchableFields, maxSearchLength = 256) {
        let searchTerm = this.getString('searchTerm');
        if (searchTerm && searchableFields.length > 0) {
            if (searchTerm.length > maxSearchLength) {
                searchTerm = searchTerm.substring(0, maxSearchLength);
            }
            const sanitizedTerm = escapeMongoRegex(searchTerm);
            this.modelQuery = this.modelQuery.find({
                $or: searchableFields.map(field => ({
                    [field]: {
                        $regex: sanitizedTerm,
                        $options: 'i',
                    },
                })),
            });
        }
        return this;
    }
    // Text search using MongoDB $text index
    textSearch(maxSearchLength = 256) {
        let searchTerm = this.getString('searchTerm');
        if (searchTerm) {
            if (searchTerm.length > maxSearchLength) {
                searchTerm = searchTerm.substring(0, maxSearchLength);
            }
            this.modelQuery = this.modelQuery.find({
                $text: { $search: searchTerm },
            });
        }
        return this;
    }
    // Generic key-value filtering with NoSQL injection protection
    filter(options = {}) {
        const defaultExcludes = [
            'searchTerm',
            'sort',
            'page',
            'limit',
            'fields',
            'timeFilter',
            'start',
            'end',
            'category',
            'latitude',
            'longitude',
            'distance',
            'maxDistance',
            'minDistance',
            'radius',
            'geoField',
            'geoMode',
            'swLat',
            'swLng',
            'neLat',
            'neLng',
            'polygon',
            'poly',
            'minPrice',
            'maxPrice',
            ...(options.customExcludes || []),
        ];
        const excludeSet = new Set(defaultExcludes);
        const cleanQueryObj = {};
        for (const [key, value] of Object.entries(this.query)) {
            if (!excludeSet.has(key) &&
                !this.isDangerousKey(key) &&
                value !== undefined &&
                value !== '') {
                const sanitized = this.sanitizeFilterValue(value);
                if (sanitized !== undefined) {
                    cleanQueryObj[key] = sanitized;
                }
            }
        }
        if (Object.keys(cleanQueryObj).length > 0) {
            this.modelQuery = this.modelQuery.find(cleanQueryObj);
        }
        if (options.categoryField) {
            this.categoryFilter(options.categoryField);
        }
        return this;
    }
    // Numeric range filter (e.g. minPrice/maxPrice, minSalary/maxSalary)
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
            this.modelQuery = this.modelQuery.find({
                [dbField]: rangeCriteria,
            });
        }
        return this;
    }
    // Generic category/tag array filtering (supports single or comma-separated values or arrays)
    categoryFilter(field = 'category', queryParamKey = 'category') {
        const categories = this.getArray(queryParamKey);
        if (categories.length > 0) {
            this.modelQuery = this.modelQuery.find({
                [field]: { $in: categories },
            });
        }
        return this;
    }
    // Location-based filtering using index-friendly bounding box on lat/lng fields
    locationFilter(latField = 'latitude', lngField = 'longitude') {
        const lat = this.getNumber('latitude');
        const lng = this.getNumber('longitude');
        const distanceKm = this.getNumber('distance');
        if (lat !== undefined && lng !== undefined && distanceKm !== undefined) {
            (0, geo_helper_1.validateCoordinates)(lat, lng);
            if (distanceKm <= 0) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Distance must be greater than 0');
            }
            const { minLat, maxLat, minLng, maxLng } = (0, geo_helper_1.calculateBoundingBox)(lat, lng, distanceKm);
            this.modelQuery = this.modelQuery.find({
                [latField]: { $gte: minLat, $lte: maxLat },
                [lngField]: { $gte: minLng, $lte: maxLng },
            });
        }
        return this;
    }
    // Geospatial: Proximity search using $near on GeoJSON Point field
    geoNear(defaultField = 'location') {
        const lat = this.getNumber('latitude');
        const lng = this.getNumber('longitude');
        const distanceKm = this.getNumber('distance');
        const maxDistanceMeters = this.getNumber('maxDistance');
        const minDistanceKm = this.getNumber('minDistance');
        const field = this.getString('geoField', defaultField);
        const hasCoords = lat !== undefined && lng !== undefined;
        const hasMax = distanceKm !== undefined || maxDistanceMeters !== undefined;
        if (hasCoords && hasMax) {
            (0, geo_helper_1.validateCoordinates)(lat, lng);
            const maxMeters = distanceKm !== undefined
                ? Math.max(0, distanceKm * 1000)
                : maxDistanceMeters !== undefined
                    ? Math.max(0, maxDistanceMeters)
                    : undefined;
            const minMeters = minDistanceKm !== undefined
                ? Math.max(0, minDistanceKm * 1000)
                : undefined;
            const nearClause = {
                $geometry: { type: 'Point', coordinates: [lng, lat] },
            };
            if (typeof maxMeters === 'number') {
                nearClause.$maxDistance = maxMeters;
            }
            if (typeof minMeters === 'number') {
                nearClause.$minDistance = minMeters;
            }
            this.modelQuery = this.modelQuery.find({
                [field]: { $near: nearClause },
            });
        }
        return this;
    }
    // Geospatial: Search within circular radius using $geoWithin + $centerSphere
    geoWithinCircle(defaultField = 'location') {
        const lat = this.getNumber('latitude');
        const lng = this.getNumber('longitude');
        const radiusKm = this.getNumber('radius', this.getNumber('distance'));
        const field = this.getString('geoField', defaultField);
        if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
            (0, geo_helper_1.validateCoordinates)(lat, lng);
            if (radiusKm <= 0) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Radius must be greater than 0');
            }
            const radiusInRadians = (0, geo_helper_1.kmToRadians)(radiusKm);
            this.modelQuery = this.modelQuery.find({
                [field]: {
                    $geoWithin: { $centerSphere: [[lng, lat], radiusInRadians] },
                },
            });
        }
        return this;
    }
    // Geospatial: Search within bounding box using $geoWithin + $box
    geoWithinBox(defaultField = 'location') {
        const swLat = this.getNumber('swLat');
        const swLng = this.getNumber('swLng');
        const neLat = this.getNumber('neLat');
        const neLng = this.getNumber('neLng');
        const field = this.getString('geoField', defaultField);
        if (swLat !== undefined &&
            swLng !== undefined &&
            neLat !== undefined &&
            neLng !== undefined) {
            (0, geo_helper_1.validateCoordinates)(swLat, swLng);
            (0, geo_helper_1.validateCoordinates)(neLat, neLng);
            this.modelQuery = this.modelQuery.find({
                [field]: {
                    $geoWithin: {
                        $box: [
                            [swLng, swLat],
                            [neLng, neLat],
                        ],
                    },
                },
            });
        }
        return this;
    }
    // Geospatial: Search within polygon using $geoWithin + $polygon
    geoWithinPolygon(defaultField = 'location') {
        const field = this.getString('geoField', defaultField);
        const polygonRaw = this.getString('polygon') || this.getString('poly');
        if (!polygonRaw)
            return this;
        const coordinates = (0, geo_helper_1.parsePolygonCoordinates)(polygonRaw);
        this.modelQuery = this.modelQuery.find({
            [field]: { $geoWithin: { $polygon: coordinates } },
        });
        return this;
    }
    // Dispatch geospatial query based on `geoMode` parameter ('near' | 'circle' | 'box' | 'polygon')
    geoQuery(defaultField = 'location') {
        const mode = this.getString('geoMode', 'near');
        if (mode === 'near')
            return this.geoNear(defaultField);
        if (mode === 'circle')
            return this.geoWithinCircle(defaultField);
        if (mode === 'box')
            return this.geoWithinBox(defaultField);
        if (mode === 'polygon')
            return this.geoWithinPolygon(defaultField);
        return this;
    }
    resolveDateRange(timeFilter) {
        const now = new Date();
        if (timeFilter === 'recently') {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            return { $gte: yesterday, $lte: now };
        }
        if (timeFilter === 'weekly') {
            return {
                $gte: (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 }),
                $lte: (0, date_fns_1.endOfWeek)(now, { weekStartsOn: 1 }),
            };
        }
        if (timeFilter === 'monthly') {
            return {
                $gte: (0, date_fns_1.startOfMonth)(now),
                $lte: (0, date_fns_1.endOfMonth)(now),
            };
        }
        if (timeFilter === 'custom') {
            const startStr = this.getString('start');
            const endStr = this.getString('end');
            if (!startStr || !endStr) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Custom date filter requires both 'start' and 'end' query parameters.");
            }
            const startDate = new Date(startStr);
            const endDate = new Date(endStr);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Invalid date format. Use ISO / 'YYYY-MM-DD' format for 'start' and 'end'.");
            }
            if (startDate > endDate) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "'start' date cannot be after 'end' date.");
            }
            return { $gte: startDate, $lte: endDate };
        }
        return undefined;
    }
    // Date filtering (recently, weekly, monthly, custom) on any target date field
    dateFilter(dateField = 'createdAt') {
        const timeFilter = this.getString('timeFilter');
        if (!timeFilter)
            return this;
        const dateRange = this.resolveDateRange(timeFilter);
        if (dateRange) {
            this.modelQuery = this.modelQuery.find({
                [dateField]: dateRange,
            });
        }
        return this;
    }
    // Sorting with configurable default sort field and optional allowed fields policy
    sort(defaultSort = '-createdAt', allowedFields) {
        const rawSort = this.getString('sort', defaultSort);
        const sort = (0, sort_helper_1.buildSortString)(rawSort, defaultSort, k => this.isDangerousKey(k), allowedFields);
        this.modelQuery = this.modelQuery.sort(sort);
        return this;
    }
    // Pagination with integer skip & limit boundaries
    paginate(defaultLimit = pagination_helper_1.DEFAULT_LIMIT, maxLimit = pagination_helper_1.MAX_LIMIT) {
        this.isPaginated = true;
        const rawLimit = this.getNumber('limit', defaultLimit, { integer: true });
        const limit = Math.min(Math.max(1, rawLimit), maxLimit);
        const rawPage = this.getNumber('page', pagination_helper_1.DEFAULT_PAGE, { integer: true });
        const page = Math.max(1, rawPage);
        const skip = (page - 1) * limit;
        this.modelQuery = this.modelQuery.skip(skip).limit(limit);
        return this;
    }
    // Field selection / projection with optional allowed fields policy
    fields(defaultFields = '-__v', allowedFields) {
        const rawFields = this.getArray('fields');
        const filtered = rawFields.filter(f => {
            if (!f || this.isDangerousKey(f))
                return false;
            if (allowedFields && allowedFields.length > 0) {
                return allowedFields.includes(this.stripFieldPrefix(f));
            }
            return true;
        });
        const fields = filtered.length > 0 ? filtered.join(' ') : defaultFields;
        this.modelQuery = this.modelQuery.select(fields);
        return this;
    }
    // Populate relations with specific fields
    populate(populateFields, selectFields) {
        if (Array.isArray(populateFields)) {
            const populates = populateFields.map(item => {
                if (typeof item === 'string') {
                    return {
                        path: item,
                        select: selectFields?.[item] ?? undefined,
                    };
                }
                return item;
            });
            this.modelQuery = this.modelQuery.populate(populates);
        }
        return this;
    }
    // Populate with specific match conditions
    populateWithMatch(path, matchConditions = {}, selectFields = '-__v') {
        this.modelQuery = this.modelQuery.populate({
            path,
            match: matchConditions,
            select: selectFields,
        });
        return this;
    }
    // Search within populated fields with regex sanitation
    searchInPopulatedFields(path, searchableFields, searchTerm, additionalMatch = {}) {
        const term = searchTerm || this.getString('searchTerm');
        if (term && searchableFields.length > 0) {
            const sanitizedTerm = escapeMongoRegex(term);
            const searchConditions = {
                $and: [
                    {
                        $or: searchableFields.map(field => ({
                            [field]: {
                                $regex: sanitizedTerm,
                                $options: 'i',
                            },
                        })),
                    },
                    additionalMatch,
                ],
            };
            this.modelQuery = this.modelQuery.populate({
                path,
                match: searchConditions,
                select: '-__v',
            });
        }
        return this;
    }
    /**
     * High-performance parallel execution: fetches data and counts total documents concurrently via Promise.all.
     * If .paginate() was not explicitly called, automatically applies default pagination boundaries.
     */
    async execute() {
        if (!this.isPaginated) {
            this.paginate(pagination_helper_1.DEFAULT_LIMIT, pagination_helper_1.MAX_LIMIT);
        }
        const startTime = Date.now();
        const filter = this.modelQuery.getFilter();
        const session = this.getSession();
        const [data, total] = await Promise.all([
            this.modelQuery.exec(),
            this.modelQuery.model.countDocuments(filter, session ? { session } : undefined),
        ]);
        const durationMs = Date.now() - startTime;
        (0, requestContext_1.recordDbQuery)(durationMs, {
            model: this.getModelName(),
            operation: 'execute_find_and_count',
            cacheHit: false,
        });
        const { page, limit } = this.extractPaginationParams();
        const totalPage = (0, pagination_helper_1.calculateTotalPages)(total, limit);
        return {
            data,
            pagination: {
                total,
                limit,
                page,
                totalPage,
            },
        };
    }
    /**
     * @deprecated Use execute() instead.
     * In-memory post-pagination filtering is intentionally unsupported because it can
     * desynchronize result counts and pagination metadata. Delegates directly to execute()
     * to guarantee database-level pagination integrity while preserving the existing return shape.
     *
     * @param _populatedFieldsToCheck Deprecated and ignored. Relation existence must be filtered at the query level.
     */
    async getFilteredResults(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _populatedFieldsToCheck = []) {
        return this.execute();
    }
    // Get total count and pagination metadata with active transaction session forwarding.
    async getPaginationInfo() {
        const startTime = Date.now();
        const filter = this.modelQuery.getFilter();
        const session = this.getSession();
        const total = await this.modelQuery.model.countDocuments(filter, session ? { session } : undefined);
        const durationMs = Date.now() - startTime;
        (0, requestContext_1.recordDbQuery)(durationMs, {
            model: this.getModelName(),
            operation: 'countDocuments',
            cacheHit: false,
        });
        const { page, limit } = this.extractPaginationParams();
        const totalPage = (0, pagination_helper_1.calculateTotalPages)(total, limit);
        return {
            total,
            limit,
            page,
            totalPage,
        };
    }
    /**
     * Facet aggregation helper for complex single-stage data and count retrieval.
     * Enforces finite limit boundaries and normalizes sort tokens.
     */
    async getAll() {
        const startTime = Date.now();
        const { page, limit, skip } = this.extractPaginationParams();
        const rawSort = this.getString('sort', '-createdAt');
        const sortParams = (0, sort_helper_1.buildSortObject)(rawSort, k => this.isDangerousKey(k));
        const facetQuery = [
            { $match: this.modelQuery.getFilter() },
            { $sort: sortParams },
            {
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }],
                    total: [{ $count: 'count' }],
                },
            },
        ];
        const [result] = await this.modelQuery.model.aggregate(facetQuery);
        const total = result?.total?.[0]?.count || 0;
        const totalPage = (0, pagination_helper_1.calculateTotalPages)(total, limit);
        const data = (result?.data || []).map((doc) => this.modelQuery.model.hydrate(doc));
        const durationMs = Date.now() - startTime;
        (0, requestContext_1.recordDbQuery)(durationMs, {
            model: this.getModelName(),
            operation: 'aggregate_facet',
            cacheHit: false,
        });
        return {
            data,
            pagination: {
                total,
                limit,
                page,
                totalPage,
            },
        };
    }
    // Clean alias for facet aggregation pagination execution.
    async executeFacet() {
        return this.getAll();
    }
}
exports.default = QueryBuilder;
//# sourceMappingURL=QueryBuilder.js.map