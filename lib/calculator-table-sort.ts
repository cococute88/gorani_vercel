export type SortDirection = "asc" | "desc";
export type SortColumnType = "number" | "date" | "string";

export type SortState<TKey extends string> = {
  key: TKey;
  direction: SortDirection;
} | null;

function isEmptySortValue(value: unknown): boolean {
  return value === null || value === undefined || value === "" || value === "-" || value === "—" || value === "Unrecovered" || value === "회복불가";
}

function toComparable(value: unknown, columnType: SortColumnType): number | string {
  if (columnType === "number") {
    if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
    if (typeof value === "string") {
      const normalized = value.replace(/[$,%x일,\s]/g, "").replace(/,/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    return Number.NaN;
  }

  if (columnType === "date") {
    if (typeof value !== "string") return Number.NaN;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return String(value ?? "");
}

export function sortRows<TRow, TKey extends string>(
  rows: readonly TRow[],
  sortKey: TKey | null | undefined,
  direction: SortDirection,
  columnType: SortColumnType,
  getValue: (row: TRow, key: TKey) => unknown,
): TRow[] {
  if (!sortKey) return [...rows];
  const multiplier = direction === "asc" ? 1 : -1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aValue = getValue(a.row, sortKey);
      const bValue = getValue(b.row, sortKey);
      const aEmpty = isEmptySortValue(aValue);
      const bEmpty = isEmptySortValue(bValue);
      if (aEmpty && bEmpty) return a.index - b.index;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      const left = toComparable(aValue, columnType);
      const right = toComparable(bValue, columnType);
      const leftInvalid = typeof left === "number" && Number.isNaN(left);
      const rightInvalid = typeof right === "number" && Number.isNaN(right);
      if (leftInvalid && rightInvalid) return a.index - b.index;
      if (leftInvalid) return 1;
      if (rightInvalid) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return left === right ? a.index - b.index : (left - right) * multiplier;
      }

      const compared = String(left).localeCompare(String(right), "ko-KR", { numeric: true, sensitivity: "base" });
      return compared === 0 ? a.index - b.index : compared * multiplier;
    })
    .map(({ row }) => row);
}

export function nextSortState<TKey extends string>(current: SortState<TKey>, key: TKey): SortState<TKey> {
  if (!current || current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortArrow<TKey extends string>(sort: SortState<TKey>, key: TKey): string {
  if (!sort || sort.key !== key) return "";
  return sort.direction === "asc" ? " ↑" : " ↓";
}
