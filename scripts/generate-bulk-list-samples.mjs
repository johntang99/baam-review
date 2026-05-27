// Generates the sample CSV and XLSX files served from /public/samples/
// for the bulk-list import flow. Re-run any time the sample data should
// change — both files are produced from the SAME `rows` array so they
// always stay in sync.
//
// Usage:
//   node scripts/generate-bulk-list-samples.mjs

import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "samples");
fs.mkdirSync(OUT_DIR, { recursive: true });

const headers = ["Name", "Email", "Phone", "Language", "Visit date", "Notes"];

// Each row demonstrates one variation the parser must handle:
//   1. Standard English row with full data
//   2. Bilingual customer (English name, Chinese language preference)
//   3. Unicode name with no phone — will route via email
//   4. Phone only, Spanish — will route via SMS
//   5. Apostrophe edge case + empty optional cells
const rows = [
  ["Marcus Davis", "marcus.d@gmail.com", "(917) 555-0234", "English", "2026-05-05", "chronic migraines"],
  ["Linda Chen", "linda.chen@example.com", "(718) 555-0188", "中文", "2026-05-06", "first visit"],
  ["张伟", "zhangwei2025@example.com", "", "Chinese", "2026-05-07", "returning patient"],
  ["Sofia Ramirez", "", "(347) 555-0421", "Spanish", "2026-05-08", "phone only — SMS preferred"],
  ["Patrick O'Connor", "patrick.o@example.com", "(212) 555-0179", "English", "2026-05-08", ""],
];

// ── CSV ─────────────────────────────────────────────────────────────
// UTF-8 BOM helps Excel on Windows auto-detect Chinese characters
// without the user having to fiddle with the import wizard.
const csvLines = [headers, ...rows].map((cols) =>
  cols
    .map((v) => {
      const s = String(v ?? "");
      // Quote any field with comma, quote, or newline; escape internal quotes.
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    })
    .join(","),
);
const csv = "﻿" + csvLines.join("\r\n") + "\r\n";
const csvPath = path.join(OUT_DIR, "bulk-review-requests-sample.csv");
fs.writeFileSync(csvPath, csv, "utf8");
console.log(`✓ Wrote ${csvPath}`);

// ── XLSX ────────────────────────────────────────────────────────────
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

// Set reasonable column widths so the sample looks clean when opened.
ws["!cols"] = [
  { wch: 18 }, // Name
  { wch: 28 }, // Email
  { wch: 18 }, // Phone
  { wch: 12 }, // Language
  { wch: 12 }, // Visit date
  { wch: 32 }, // Notes
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Customers");

const xlsxPath = path.join(OUT_DIR, "bulk-review-requests-sample.xlsx");
XLSX.writeFile(wb, xlsxPath);
console.log(`✓ Wrote ${xlsxPath}`);

console.log("\nDone. Drop the files into /app/lists/new and they'll be served as-is.");
