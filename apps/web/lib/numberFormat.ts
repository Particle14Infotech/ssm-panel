/**
 * Format numbers with the Indian numbering system (e.g. 1,00,000)
 */
export function formatIndianNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-IN");
}
