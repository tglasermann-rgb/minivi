/** CSV mínimo compatible con Shopify/Excel: comillas dobles, saltos de línea CRLF, BOM opcional. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][], opts: { bom?: boolean } = {}): string {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return (opts.bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}
