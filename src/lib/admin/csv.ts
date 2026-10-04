/** RFC 4180 CSV with a UTF-8 BOM so Excel shows accents (María, Óscar) correctly. */
export function toCsv(headers: string[], rows: Array<Array<string | number | Date | null | undefined>>): string {
  const cell = (v: string | number | Date | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? v.toISOString() : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
