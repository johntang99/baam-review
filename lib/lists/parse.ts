// Minimal delimiter-auto CSV/TSV parser. The plan (§2.2) specifies papaparse
// "already in v1", but v1 has zero parsing deps and a strong minimal-dependency
// convention — reconciled to an in-house parser. Contact-list data is simple
// (no embedded newlines in practice) so this handles the realistic cases:
// tab OR comma delimiter, optional quoted fields, optional header row.

export interface ParsedTable {
  headers: string[] | null; // null when no header row detected
  rows: string[][];
  delimiter: "\t" | ",";
}

function detectDelimiter(sample: string): "\t" | "," {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs >= commas && tabs > 0 ? "\t" : ",";
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Header auto-detection (§5): row 1 is treated as DATA (not headers) if any
 * cell contains "@" (looks like an email). Otherwise row 1 is the header row.
 */
function looksLikeHeader(cells: string[]): boolean {
  return !cells.some((c) => c.includes("@"));
}

export function parseTable(raw: string): ParsedTable {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return { headers: null, rows: [], delimiter: "\t" };

  const delimiter = detectDelimiter(text);
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: null, rows: [], delimiter };

  const firstCells = splitLine(lines[0], delimiter);
  const hasHeader = looksLikeHeader(firstCells);

  const headers = hasHeader ? firstCells : null;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines.map((l) => splitLine(l, delimiter));

  return { headers, rows, delimiter };
}

export type ColumnKey = "name" | "email" | "phone" | "language" | "notes";

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  name: ["name", "customer", "customer name", "full name", "patient", "patient name"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number", "tel"],
  language: ["language", "lang", "preferred language", "locale"],
  notes: ["notes", "note", "comment", "comments", "context", "visit notes"],
};

// Positional fallback when there's no header row. Mirrors the prototype's
// sample column order: Name, Email, Phone, Language, Visit date, Notes.
const POSITIONAL: ColumnKey[] = ["name", "email", "phone", "language", "notes"];

export interface ColumnMap {
  // index into each row, or -1 if unmapped
  name: number;
  email: number;
  phone: number;
  language: number;
  notes: number;
  visitDate: number;
  // the source column label shown in the mapping UI
  sourceLabels: Record<ColumnKey, string | null>;
}

export function mapColumns(table: ParsedTable): ColumnMap {
  const map: ColumnMap = {
    name: -1,
    email: -1,
    phone: -1,
    language: -1,
    notes: -1,
    visitDate: -1,
    sourceLabels: {
      name: null,
      email: null,
      phone: null,
      language: null,
      notes: null,
    },
  };

  if (table.headers) {
    const lower = table.headers.map((h) => h.toLowerCase().trim());
    (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
      const idx = lower.findIndex((h) =>
        HEADER_ALIASES[key].includes(h),
      );
      if (idx >= 0) {
        map[key] = idx;
        map.sourceLabels[key] = table.headers![idx];
      }
    });
    const vIdx = lower.findIndex(
      (h) => h.includes("visit") || h.includes("date"),
    );
    if (vIdx >= 0) map.visitDate = vIdx;
  } else {
    // Positional: Name, Email, Phone, Language, [Visit date], Notes
    POSITIONAL.forEach((key, i) => {
      map[key] = i;
      map.sourceLabels[key] = `Column ${i + 1}`;
    });
    // Sample layout has visit date at index 4 and notes at 5.
    map.notes = 5;
    map.visitDate = 4;
    map.sourceLabels.notes = "Column 6";
  }

  return map;
}
