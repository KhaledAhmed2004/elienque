export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export type IPaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

// Extracts a numeric value safely from a query record.
export function extractNumber(
  query: Record<string, unknown>,
  key: string,
  defaultValue?: number,
  options: { integer?: boolean } = {},
): number | undefined {
  const val = query[key];
  if (typeof val === 'number' && Number.isFinite(val)) {
    return options.integer ? Math.floor(val) : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === 'NaN' ||
      trimmed === 'Infinity' ||
      trimmed === '-Infinity'
    ) {
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
export function extractPaginationParams(
  query: Record<string, unknown>,
  defaultLimit: number = DEFAULT_LIMIT,
  maxLimit: number = MAX_LIMIT,
  defaultPage: number = DEFAULT_PAGE,
): IPaginationParams {
  const rawLimit =
    extractNumber(query, 'limit', defaultLimit, { integer: true }) ??
    defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);

  const rawPage =
    extractNumber(query, 'page', defaultPage, { integer: true }) ?? defaultPage;
  const page = Math.max(1, rawPage);

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// Pure function: Calculates total pages safely.
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / Math.max(1, limit));
}
