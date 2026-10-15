import {
  parsePaginationParams,
  formatPaginatedResult,
} from "./pagination.util";

describe("Cursor Pagination Utility", () => {
  it("defaults limit to 20 and takes limit + 1", () => {
    const params = parsePaginationParams({});
    expect(params.take).toBe(21);
    expect(params.cursor).toBeUndefined();
    expect(params.skip).toBeUndefined();
  });

  it("caps limit at 100", () => {
    const params = parsePaginationParams({ limit: 500 });
    expect(params.take).toBe(101); // 100 + 1
  });

  it("attaches cursor and skip=1 when cursor is supplied", () => {
    const params = parsePaginationParams({ cursor: "item_123", limit: 10 });
    expect(params.take).toBe(11);
    expect(params.skip).toBe(1);
    expect(params.cursor).toEqual({ id: "item_123" });
  });

  it("formats paginated results correctly when there are more items", () => {
    const mockItems = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
      { id: "3", name: "C" },
    ];
    const result = formatPaginatedResult(mockItems, 2);
    expect(result.data.length).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("2");
  });

  it("formats paginated results correctly when there are no more items", () => {
    const mockItems = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ];
    const result = formatPaginatedResult(mockItems, 2);
    expect(result.data.length).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
