// CSV that opens correctly in Excel pt-BR: UTF-8 BOM, ";" separator, CRLF line ends.
const BOM = "﻿";

function cell(v) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Text typed by a visitor must never run as a spreadsheet formula.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ label, value: (row) => any }]; defaults to the keys of the first row.
export function toCSV(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ label: k, value: (r) => r[k] }));
  const lines = [cols.map((c) => cell(c.label)).join(";")];
  rows.forEach((r) => lines.push(cols.map((c) => cell(c.value(r))).join(";")));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function downloadCSV(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
