import { FilterQuery, PopulateOptions, Query } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../errors/ApiError';
import { recordDbQuery } from '../logging/requestContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  extractPaginationParams,
  calculateTotalPages,
  extractNumber,
  IPaginationParams,
} from './helpers/pagination.helper';
import {
  validateCoordinates,
  calculateBoundingBox,
  kmToRadians,
  parsePolygonCoordinates,
} from './helpers/geo.helper';
import {
  buildSortString,
  buildSortObject,
  stripSortPrefix,
} from './helpers/sort.helper';

// Escapes regex special characters safely without introducing PCRE2-incompatible Unicode escapes.
const escapeMongoRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };

// eslint-disable-next-line @typescript-eslint/ban-types
export type FieldKey<T> = Extract<keyof T, string> | (string & {});

export type IPaginationInfo = {
  total: number;
  limit: number;
  page: number;
  totalPage: number;
};

export type IQueryResult<T> = {
  data: T[];
  pagination: IPaginationInfo;
};

export type IFilterOptions<T = Record<string, unknown>> = {
  // Additional query parameter keys to exclude from direct Mongo find filtering
  customExcludes?: string[];
  // Default category field name if ?category is passed (defaults to undefined/none)
  categoryField?: FieldKey<T>;
};

// Generic, enterprise-grade MongoDB / Mongoose Query Builder.
// Provides safe filtering, searching, sorting, pagination, geospatial queries, and population.
class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;
  private isPaginated = false;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown> = {}) {
    this.modelQuery = modelQuery;
    this.query = query || {};
  }

  private getSession() {
    return typeof this.modelQuery.getOptions === 'function'
      ? this.modelQuery.getOptions()?.session
      : undefined;
  }

  private getModelName(): string {
    const model = this.modelQuery.model as unknown as {
      modelName?: string;
      collection?: { name?: string };
    };
    return model?.modelName || model?.collection?.name || 'UnknownModel';
  }

  private validateCoordinates(lat: number, lng: number): void {
    validateCoordinates(lat, lng);
  }

  private stripFieldPrefix(field: string): string {
    return stripSortPrefix(field);
  }

  private extractPaginationParams(): IPaginationParams {
    return extractPaginationParams(
      this.query,
      DEFAULT_LIMIT,
      MAX_LIMIT,
      DEFAULT_PAGE,
    );
  }

  private isDangerousKey(key: string): boolean {
    if (!key || typeof key !== 'string') return true;
    const lower = key.toLowerCase();
    return (
      lower.includes('__proto__') ||
      lower.includes('constructor') ||
      lower.includes('prototype') ||
      lower.includes('$')
    );
  }

  private getString(key: string, defaultValue?: string): string | undefined {
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

  private getArray(key: string): string[] {
    const val = this.query[key];
    if (!val) return [];
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

  private getNumber(
    key: string,
    defaultValue?: number,
    options: { integer?: boolean } = {},
  ): number | undefined {
    return extractNumber(this.query, key, defaultValue, options);
  }

  // Sanitizes object keys to prevent NoSQL query operator injection and Prototype Pollution
  // Depth is capped to prevent stack exhaustion on deeply nested payloads.
  private sanitizeFilterValue(
    value: unknown,
    depth = 0,
    maxDepth = 5,
  ): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (depth >= maxDepth) return undefined;

    if (Array.isArray(value)) {
      return value
        .map(v => this.sanitizeFilterValue(v, depth + 1, maxDepth))
        .filter(v => v !== undefined);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
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
  search(searchableFields: FieldKey<T>[], maxSearchLength = 256) {
    let searchTerm = this.getString('searchTerm');
    if (searchTerm && searchableFields.length > 0) {
      if (searchTerm.length > maxSearchLength) {
        searchTerm = searchTerm.substring(0, maxSearchLength);
      }
      const sanitizedTerm = escapeMongoRegex(searchTerm);

      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          field =>
            ({
              [field]: {
                $regex: sanitizedTerm,
                $options: 'i',
              },
            }) as FilterQuery<T>,
        ),
      } as FilterQuery<T>);
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
      } as FilterQuery<T>);
    }
    return this;
  }

  // Generic key-value filtering with NoSQL injection protection
  filter(options: IFilterOptions<T> = {}) {
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
    const cleanQueryObj: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.query)) {
      if (
        !excludeSet.has(key) &&
        !this.isDangerousKey(key) &&
        value !== undefined &&
        value !== ''
      ) {
        const sanitized = this.sanitizeFilterValue(value);
        if (sanitized !== undefined) {
          cleanQueryObj[key] = sanitized;
        }
      }
    }

    if (Object.keys(cleanQueryObj).length > 0) {
      this.modelQuery = this.modelQuery.find(cleanQueryObj as FilterQuery<T>);
    }

    if (options.categoryField) {
      this.categoryFilter(options.categoryField);
    }

    return this;
  }

  // Numeric range filter (e.g. minPrice/maxPrice, minSalary/maxSalary)
  range(dbField: FieldKey<T>, minQueryKey?: string, maxQueryKey?: string) {
    const capitalized = dbField.charAt(0).toUpperCase() + dbField.slice(1);
    const minKey = minQueryKey || `min${capitalized}`;
    const maxKey = maxQueryKey || `max${capitalized}`;

    const min = this.getNumber(minKey);
    const max = this.getNumber(maxKey);

    const rangeCriteria: Record<string, number> = {};
    if (min !== undefined) rangeCriteria.$gte = min;
    if (max !== undefined) rangeCriteria.$lte = max;

    if (Object.keys(rangeCriteria).length > 0) {
      this.modelQuery = this.modelQuery.find({
        [dbField]: rangeCriteria,
      } as FilterQuery<T>);
    }
    return this;
  }

  // Generic category/tag array filtering (supports single or comma-separated values or arrays)
  categoryFilter(
    field: FieldKey<T> = 'category',
    queryParamKey: string = 'category',
  ) {
    const categories = this.getArray(queryParamKey);
    if (categories.length > 0) {
      this.modelQuery = this.modelQuery.find({
        [field]: { $in: categories },
      } as FilterQuery<T>);
    }
    return this;
  }

  // Location-based filtering using index-friendly bounding box on lat/lng fields
  locationFilter(
    latField: FieldKey<T> = 'latitude',
    lngField: FieldKey<T> = 'longitude',
  ) {
    const lat = this.getNumber('latitude');
    const lng = this.getNumber('longitude');
    const distanceKm = this.getNumber('distance');

    if (lat !== undefined && lng !== undefined && distanceKm !== undefined) {
      validateCoordinates(lat, lng);
      if (distanceKm <= 0) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          'Distance must be greater than 0',
        );
      }

      const { minLat, maxLat, minLng, maxLng } = calculateBoundingBox(
        lat,
        lng,
        distanceKm,
      );

      this.modelQuery = this.modelQuery.find({
        [latField]: { $gte: minLat, $lte: maxLat },
        [lngField]: { $gte: minLng, $lte: maxLng },
      } as FilterQuery<T>);
    }

    return this;
  }

  // Geospatial: Proximity search using $near on GeoJSON Point field
  geoNear(defaultField: FieldKey<T> = 'location') {
    const lat = this.getNumber('latitude');
    const lng = this.getNumber('longitude');
    const distanceKm = this.getNumber('distance');
    const maxDistanceMeters = this.getNumber('maxDistance');
    const minDistanceKm = this.getNumber('minDistance');
    const field = this.getString('geoField', defaultField)!;

    const hasCoords = lat !== undefined && lng !== undefined;
    const hasMax = distanceKm !== undefined || maxDistanceMeters !== undefined;

    if (hasCoords && hasMax) {
      validateCoordinates(lat, lng);

      const maxMeters =
        distanceKm !== undefined
          ? Math.max(0, distanceKm * 1000)
          : maxDistanceMeters !== undefined
            ? Math.max(0, maxDistanceMeters)
            : undefined;

      const minMeters =
        minDistanceKm !== undefined
          ? Math.max(0, minDistanceKm * 1000)
          : undefined;

      const nearClause: Record<string, unknown> = {
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
      } as FilterQuery<T>);
    }
    return this;
  }

  // Geospatial: Search within circular radius using $geoWithin + $centerSphere
  geoWithinCircle(defaultField: FieldKey<T> = 'location') {
    const lat = this.getNumber('latitude');
    const lng = this.getNumber('longitude');
    const radiusKm = this.getNumber('radius', this.getNumber('distance'));
    const field = this.getString('geoField', defaultField)!;

    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      validateCoordinates(lat, lng);
      if (radiusKm <= 0) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          'Radius must be greater than 0',
        );
      }

      const radiusInRadians = kmToRadians(radiusKm);

      this.modelQuery = this.modelQuery.find({
        [field]: {
          $geoWithin: { $centerSphere: [[lng, lat], radiusInRadians] },
        },
      } as FilterQuery<T>);
    }
    return this;
  }

  // Geospatial: Search within bounding box using $geoWithin + $box
  geoWithinBox(defaultField: FieldKey<T> = 'location') {
    const swLat = this.getNumber('swLat');
    const swLng = this.getNumber('swLng');
    const neLat = this.getNumber('neLat');
    const neLng = this.getNumber('neLng');
    const field = this.getString('geoField', defaultField)!;

    if (
      swLat !== undefined &&
      swLng !== undefined &&
      neLat !== undefined &&
      neLng !== undefined
    ) {
      validateCoordinates(swLat, swLng);
      validateCoordinates(neLat, neLng);

      this.modelQuery = this.modelQuery.find({
        [field]: {
          $geoWithin: {
            $box: [
              [swLng, swLat],
              [neLng, neLat],
            ],
          },
        },
      } as FilterQuery<T>);
    }
    return this;
  }

  // Geospatial: Search within polygon using $geoWithin + $polygon
  geoWithinPolygon(defaultField: FieldKey<T> = 'location') {
    const field = this.getString('geoField', defaultField)!;
    const polygonRaw = this.getString('polygon') || this.getString('poly');
    if (!polygonRaw) return this;

    const coordinates = parsePolygonCoordinates(polygonRaw);

    this.modelQuery = this.modelQuery.find({
      [field]: { $geoWithin: { $polygon: coordinates } },
    } as FilterQuery<T>);

    return this;
  }

  // Dispatch geospatial query based on `geoMode` parameter ('near' | 'circle' | 'box' | 'polygon')
  geoQuery(defaultField: FieldKey<T> = 'location') {
    const mode = this.getString('geoMode', 'near');
    if (mode === 'near') return this.geoNear(defaultField);
    if (mode === 'circle') return this.geoWithinCircle(defaultField);
    if (mode === 'box') return this.geoWithinBox(defaultField);
    if (mode === 'polygon') return this.geoWithinPolygon(defaultField);
    return this;
  }

  private resolveDateRange(
    timeFilter: string,
  ): Record<string, Date> | undefined {
    const now = new Date();

    if (timeFilter === 'recently') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { $gte: yesterday, $lte: now };
    }

    if (timeFilter === 'weekly') {
      return {
        $gte: startOfWeek(now, { weekStartsOn: 1 }),
        $lte: endOfWeek(now, { weekStartsOn: 1 }),
      };
    }

    if (timeFilter === 'monthly') {
      return {
        $gte: startOfMonth(now),
        $lte: endOfMonth(now),
      };
    }

    if (timeFilter === 'custom') {
      const startStr = this.getString('start');
      const endStr = this.getString('end');

      if (!startStr || !endStr) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Custom date filter requires both 'start' and 'end' query parameters.",
        );
      }

      const startDate = new Date(startStr);
      const endDate = new Date(endStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Invalid date format. Use ISO / 'YYYY-MM-DD' format for 'start' and 'end'.",
        );
      }

      if (startDate > endDate) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "'start' date cannot be after 'end' date.",
        );
      }

      return { $gte: startDate, $lte: endDate };
    }

    return undefined;
  }

  // Date filtering (recently, weekly, monthly, custom) on any target date field
  dateFilter(dateField: FieldKey<T> = 'createdAt') {
    const timeFilter = this.getString('timeFilter');
    if (!timeFilter) return this;

    const dateRange = this.resolveDateRange(timeFilter);
    if (dateRange) {
      this.modelQuery = this.modelQuery.find({
        [dateField]: dateRange,
      } as FilterQuery<T>);
    }

    return this;
  }

  // Sorting with configurable default sort field and optional allowed fields policy
  sort(defaultSort: string = '-createdAt', allowedFields?: FieldKey<T>[]) {
    const rawSort = this.getString('sort', defaultSort);
    const sort = buildSortString(
      rawSort,
      defaultSort,
      k => this.isDangerousKey(k),
      allowedFields as string[] | undefined,
    );
    this.modelQuery = this.modelQuery.sort(sort);
    return this;
  }

  // Pagination with integer skip & limit boundaries
  paginate(defaultLimit: number = DEFAULT_LIMIT, maxLimit: number = MAX_LIMIT) {
    this.isPaginated = true;
    const rawLimit = this.getNumber('limit', defaultLimit, { integer: true })!;
    const limit = Math.min(Math.max(1, rawLimit), maxLimit);
    const rawPage = this.getNumber('page', DEFAULT_PAGE, { integer: true })!;
    const page = Math.max(1, rawPage);
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  // Field selection / projection with optional allowed fields policy
  fields(defaultFields: string = '-__v', allowedFields?: FieldKey<T>[]) {
    const rawFields = this.getArray('fields');
    const filtered = rawFields.filter(f => {
      if (!f || this.isDangerousKey(f)) return false;
      if (allowedFields && allowedFields.length > 0) {
        return (allowedFields as string[]).includes(this.stripFieldPrefix(f));
      }
      return true;
    });

    const fields = filtered.length > 0 ? filtered.join(' ') : defaultFields;
    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  // Populate relations with specific fields
  populate(
    populateFields: string[] | PopulateOptions[],
    selectFields?: Record<string, unknown>,
  ) {
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
  populateWithMatch(
    path: string,
    matchConditions: Record<string, unknown> = {},
    selectFields: string = '-__v',
  ) {
    this.modelQuery = this.modelQuery.populate({
      path,
      match: matchConditions,
      select: selectFields,
    });
    return this;
  }

  // Search within populated fields with regex sanitation
  searchInPopulatedFields(
    path: string,
    searchableFields: string[],
    searchTerm?: string,
    additionalMatch: Record<string, unknown> = {},
  ) {
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
  async execute(): Promise<IQueryResult<T>> {
    if (!this.isPaginated) {
      this.paginate(DEFAULT_LIMIT, MAX_LIMIT);
    }
    const startTime = Date.now();
    const filter = this.modelQuery.getFilter();
    const session = this.getSession();

    const [data, total] = await Promise.all([
      this.modelQuery.exec(),
      this.modelQuery.model.countDocuments(
        filter,
        session ? { session } : undefined,
      ),
    ]);

    const durationMs = Date.now() - startTime;
    recordDbQuery(durationMs, {
      model: this.getModelName(),
      operation: 'execute_find_and_count',
      cacheHit: false,
    });

    const { page, limit } = this.extractPaginationParams();
    const totalPage = calculateTotalPages(total, limit);

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
    _populatedFieldsToCheck: string[] = [],
  ): Promise<IQueryResult<T>> {
    return this.execute();
  }

  // Get total count and pagination metadata with active transaction session forwarding.
  async getPaginationInfo(): Promise<IPaginationInfo> {
    const startTime = Date.now();
    const filter = this.modelQuery.getFilter();
    const session = this.getSession();
    const total = await this.modelQuery.model.countDocuments(
      filter,
      session ? { session } : undefined,
    );
    const durationMs = Date.now() - startTime;

    recordDbQuery(durationMs, {
      model: this.getModelName(),
      operation: 'countDocuments',
      cacheHit: false,
    });

    const { page, limit } = this.extractPaginationParams();
    const totalPage = calculateTotalPages(total, limit);

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
  async getAll(): Promise<IQueryResult<T>> {
    const startTime = Date.now();
    const { page, limit, skip } = this.extractPaginationParams();
    const rawSort = this.getString('sort', '-createdAt');
    const sortParams = buildSortObject(rawSort, k => this.isDangerousKey(k));

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
    const totalPage = calculateTotalPages(total, limit);
    const data = (result?.data || []).map((doc: Record<string, unknown>) =>
      this.modelQuery.model.hydrate(doc),
    );

    const durationMs = Date.now() - startTime;
    recordDbQuery(durationMs, {
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
  async executeFacet(): Promise<IQueryResult<T>> {
    return this.getAll();
  }
}

export default QueryBuilder;
