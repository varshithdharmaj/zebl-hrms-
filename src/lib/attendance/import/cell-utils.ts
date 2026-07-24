export function cellValue(row: unknown[], index: number): string {
  if (index < 0) return "";
  const val = row[index];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/**
 * Normalize time cells for attendance import.
 * Preserves legacy Excel string behavior: non-numeric/non-Date values are returned trimmed as-is
 * (no HH:mm:ss re-normalization), matching the pre-PDF-import Excel path.
 */
export function formatTimeCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  return String(value).trim() || null;
}
