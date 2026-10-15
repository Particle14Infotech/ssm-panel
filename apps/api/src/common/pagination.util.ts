export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function parsePaginationParams(params: CursorPaginationParams): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  const rawLimit = Number(params.limit);
  const take = Math.min(Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit), MAX_LIMIT);

  if (params.cursor) {
    return {
      take: take + 1, // Fetch 1 extra to determine hasMore
      skip: 1, // Skip the cursor itself
      cursor: { id: params.cursor },
    };
  }

  return {
    take: take + 1,
  };
}

export function formatPaginatedResult<T extends { id: string }>(
  items: T[],
  limit: number = DEFAULT_LIMIT
): PaginatedResult<T> {
  const actualLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const hasMore = items.length > actualLimit;
  const data = hasMore ? items.slice(0, actualLimit) : items;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return {
    data,
    nextCursor,
    hasMore,
  };
}
