"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  ClipboardPaste,
  Upload,
  Pencil,
  Plus,
  X,
  TriangleAlert,
  CircleX,
  Download,
} from "lucide-react";
import { parseTable, mapColumns } from "@/lib/lists/parse";
import { validateRow, type Lang, type RawRow } from "@/lib/lists/normalize";
import { createList } from "../actions";

export interface NewListFormProps {
  locations: { id: string; name: string; defaultLanguage: string }[];
  selectedLocationId: string | null;
  defaultName: string;
}

type Tab = "csv" | "paste" | "manual";

const LANGUAGES = [
  { value: "zh", label: "中文 (Chinese)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const LANG_PILL: Record<Lang, { text: string; cls: string }> = {
  en: { text: "EN", cls: "bg-success-soft text-success" },
  zh: { text: "中文", cls: "bg-alert-soft text-alert" },
  es: { text: "ES", cls: "bg-warn-soft text-warn" },
};

interface ManualRow {
  name: string;
  email: string;
  phone: string;
  language: string;
  notes: string;
}

const EMPTY_MANUAL: ManualRow = {
  name: "",
  email: "",
  phone: "",
  language: "",
  notes: "",
};

export function NewListForm({
  locations,
  selectedLocationId,
  defaultName,
}: NewListFormProps) {
  const [name, setName] = useState(defaultName);
  const [locationId, setLocationId] = useState(
    selectedLocationId && locations.some((l) => l.id === selectedLocationId)
      ? selectedLocationId
      : (locations[0]?.id ?? ""),
  );
  const [defaultLanguage, setDefaultLanguage] = useState<Lang>("zh");

  const [tab, setTab] = useState<Tab>("paste");
  const [pasteText, setPasteText] = useState("");
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { ...EMPTY_MANUAL },
  ]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop handlers for the upload area. dragenter/dragover must
  // each call preventDefault() so the browser allows the drop instead of
  // navigating to the file. dragleave is tricky because it fires for
  // every child element; the relatedTarget check filters out internal
  // bubble-ups so the "I'm being dragged over" UI only flips off when
  // the cursor actually leaves the drop zone.
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  // ---- Parse the active tab into RawRow[] ----
  const rawRows: RawRow[] = useMemo(() => {
    if (tab === "manual") {
      return manualRows
        .filter((r) => r.name || r.email || r.phone)
        .map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          language: r.language,
          notes: r.notes,
        }));
    }
    if (!pasteText.trim()) return [];
    const table = parseTable(pasteText);
    const cm = mapColumns(table);
    return table.rows.map((cells) => ({
      name: cm.name >= 0 ? (cells[cm.name] ?? "") : "",
      email: cm.email >= 0 ? (cells[cm.email] ?? "") : "",
      phone: cm.phone >= 0 ? (cells[cm.phone] ?? "") : "",
      language: cm.language >= 0 ? (cells[cm.language] ?? "") : "",
      notes: cm.notes >= 0 ? (cells[cm.notes] ?? "") : "",
      visitDate: cm.visitDate >= 0 ? (cells[cm.visitDate] ?? "") : "",
    }));
  }, [tab, pasteText, manualRows]);

  const columnMap = useMemo(() => {
    if (tab === "manual" || !pasteText.trim()) return null;
    return mapColumns(parseTable(pasteText));
  }, [tab, pasteText]);

  const detectedDelimiter = useMemo(() => {
    if (tab === "manual" || !pasteText.trim()) return null;
    return parseTable(pasteText).delimiter === "\t" ? "Tab" : "Comma";
  }, [tab, pasteText]);

  // Client-side validation preview. Server re-validates with real opt-outs on
  // submit; the empty set here still applies the no-contact / Mei-Hong-dup /
  // unknown-language / no-phone rules.
  const validated = useMemo(
    () => rawRows.map((r) => validateRow(r, defaultLanguage, new Set())),
    [rawRows, defaultLanguage],
  );
  const readyCount = validated.filter((v) => !v.excludedReason).length;
  const warnCount = validated.filter(
    (v) => !v.excludedReason && v.warnings.length > 0,
  ).length;
  const excludedCount = validated.length - readyCount;

  async function onFile(file: File) {
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (isXlsx) {
      // Lazy-load SheetJS only when the user actually picks an Excel file.
      // The library is ~200 KB; keep it out of the initial bundle.
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          setError("Excel file has no sheets.");
          return;
        }
        const sheet = wb.Sheets[firstSheetName];
        // sheet_to_csv preserves the header row and renders empty cells as
        // empty fields — exactly what our existing parser expects.
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        setPasteText(csv);
        setTab("paste");
      } catch (e) {
        setError(
          e instanceof Error
            ? `Couldn't read Excel file: ${e.message}`
            : "Couldn't read Excel file.",
        );
      }
      return;
    }

    // CSV / TSV path — read as plain text.
    const reader = new FileReader();
    reader.onload = () => {
      setPasteText(String(reader.result ?? ""));
      setTab("paste"); // CSV feeds the same parser/preview as paste
    };
    reader.readAsText(file);
  }

  function submit(destination: "draft" | "review") {
    setError(null);
    startTransition(async () => {
      const res = await createList({
        name,
        locationId,
        defaultLanguage,
        rows: rawRows,
        destination,
      });
      // Only returns when there's an error; success path redirects.
      if (res && !res.ok) setError(res.error ?? "Couldn't create the list.");
    });
  }

  return (
    <main className="px-10 py-8 pb-16 max-w-[1280px]">
      {/* BREADCRUMB */}
      <div className="flex items-center justify-between mb-7">
        <Link
          href="/app/lists"
          className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.04em] text-text-muted font-medium hover:text-ink"
        >
          <ChevronLeft className="h-3 w-3" />
          Lists / <span className="text-ink">New list</span>
        </Link>
      </div>

      {/* PAGE HEADER */}
      <div className="mb-8">
        <p className="text-[11.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-2">
          Step 1 of 2 · Import customers
        </p>
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink mb-2.5">
          Create a new <em className="italic text-forest">list.</em>
        </h1>
        <p className="font-serif italic text-[17px] text-text-soft max-w-[600px] leading-relaxed">
          Import your client&apos;s customer list, review it, then send all in
          one batch. Three ways to import — pick whichever matches how you got
          the data.
        </p>
      </div>

      {/* LIST METADATA */}
      <div className="bg-paper border border-border-base rounded-2xl px-7 py-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label
              htmlFor="list-name"
              className="block text-[12px] font-medium text-text mb-2 tracking-[0.02em]"
            >
              List name
            </label>
            <input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[14px] text-text focus:border-forest focus:bg-paper focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="list-location"
              className="block text-[12px] font-medium text-text mb-2 tracking-[0.02em]"
            >
              Source client (location)
            </label>
            <select
              id="list-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[14px] text-text focus:border-forest focus:bg-paper focus:outline-none"
            >
              {locations.length === 0 && (
                <option value="">No locations available</option>
              )}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="list-language"
              className="block text-[12px] font-medium text-text mb-2 tracking-[0.02em]"
            >
              Default language
              <span className="ml-1 font-normal text-text-muted">
                if not specified
              </span>
            </label>
            <select
              id="list-language"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value as Lang)}
              className="w-full cursor-pointer rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[14px] text-text focus:border-forest focus:bg-paper focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* INTAKE CARD */}
      <div className="bg-paper border border-border-base rounded-2xl overflow-hidden">
        {/* TABS */}
        <div className="flex border-b border-border-base bg-cream-deep">
          <TabButton
            active={tab === "csv"}
            onClick={() => setTab("csv")}
            icon={<Upload className="h-4 w-4" />}
            title="File upload"
            sub="Excel or CSV"
          />
          <TabButton
            active={tab === "paste"}
            onClick={() => setTab("paste")}
            icon={<ClipboardPaste className="h-4 w-4" />}
            title="Paste from spreadsheet"
            sub="Most common path"
          />
          <TabButton
            active={tab === "manual"}
            onClick={() => setTab("manual")}
            icon={<Pencil className="h-4 w-4" />}
            title="Manual entry"
            sub="Short lists, fast adds"
          />
        </div>

        {/* BODY */}
        <div className="px-9 py-8">
          {tab === "csv" && (
            <>
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <div className="font-display text-[18px] text-ink">
                  Upload a spreadsheet
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/samples/bulk-review-requests-sample.csv"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12px] font-medium text-text-soft hover:bg-cream-deep hover:text-ink whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Sample CSV
                  </a>
                  <a
                    href="/samples/bulk-review-requests-sample.xlsx"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12px] font-medium text-text-soft hover:bg-cream-deep hover:text-ink whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Sample Excel
                  </a>
                </div>
              </div>
              <p className="text-[13.5px] text-text-soft mb-5">
                Drop an Excel (.xlsx) or CSV/TSV file here. Columns can be in
                any order — we auto-detect them. Or use a sample as a starting
                point: open it in Excel/Numbers, replace the rows with your
                customers, save, and drop it back here.
              </p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full rounded-xl border-2 border-dashed py-12 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-forest/30 ${
                  isDragging
                    ? "border-forest bg-forest/[0.06]"
                    : "border-border-base bg-cream hover:border-forest hover:bg-cream-deep/30"
                }`}
              >
                <Upload
                  className={`h-7 w-7 mx-auto mb-3 transition-colors ${
                    isDragging ? "text-forest" : "text-text-muted"
                  }`}
                />
                <p className="text-[14px] text-text font-medium">
                  {isDragging ? "Drop to upload" : "Drop file here or click to browse"}
                </p>
                <p className="text-[12.5px] text-text-muted mt-1">
                  .xlsx, .csv, or .tsv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </>
          )}

          {tab === "paste" && (
            <>
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <div className="font-display text-[18px] text-ink">
                  Paste from a spreadsheet
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/samples/bulk-review-requests-sample.csv"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12px] font-medium text-text-soft hover:bg-cream-deep hover:text-ink whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Sample CSV
                  </a>
                  <a
                    href="/samples/bulk-review-requests-sample.xlsx"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12px] font-medium text-text-soft hover:bg-cream-deep hover:text-ink whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Sample Excel
                  </a>
                </div>
              </div>
              <p className="text-[13.5px] text-text-soft mb-4">
                Copy rows from Google Sheets or Excel and paste below. Columns
                can be in any order — we&apos;ll auto-detect them. Open the
                sample in your spreadsheet app to see the expected format.
              </p>
              <textarea
                spellCheck={false}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  "Name\tEmail\tPhone\tLanguage\tVisit date\tNotes\nMarcus Davis\tmarcus.d@gmail.com\t(917) 555-0234\tEnglish\t2026-05-05\tchronic migraines"
                }
                rows={10}
                className="w-full rounded-xl border border-border-base bg-cream px-4 py-3 font-mono text-[12.5px] leading-relaxed text-text focus:border-forest focus:bg-paper focus:outline-none"
              />
              {rawRows.length > 0 && (
                <div className="flex flex-wrap gap-5 mt-3 text-[12px] text-text-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {columnMap?.sourceLabels.name
                      ? "Header row auto-detected"
                      : "No header — positional mapping"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {rawRows.length} rows parsed
                  </span>
                  {detectedDelimiter && (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-success" />
                      {detectedDelimiter}-separated detected
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "manual" && (
            <>
              <div className="font-display text-[18px] text-ink mb-1.5">
                Manual entry
              </div>
              <p className="text-[13.5px] text-text-soft mb-5">
                Type customers in directly. Good for short lists.
              </p>
              <div className="space-y-2.5">
                {manualRows.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_1.5fr_32px] gap-2 items-center"
                  >
                    <input
                      placeholder="Name"
                      value={r.name}
                      onChange={(e) =>
                        setManualRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-border-base bg-cream px-3 py-2 text-[13px] focus:border-forest focus:bg-paper focus:outline-none"
                    />
                    <input
                      placeholder="Email"
                      value={r.email}
                      onChange={(e) =>
                        setManualRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, email: e.target.value } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-border-base bg-cream px-3 py-2 text-[13px] focus:border-forest focus:bg-paper focus:outline-none"
                    />
                    <input
                      placeholder="Phone"
                      value={r.phone}
                      onChange={(e) =>
                        setManualRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, phone: e.target.value } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-border-base bg-cream px-3 py-2 text-[13px] focus:border-forest focus:bg-paper focus:outline-none"
                    />
                    <input
                      placeholder="Lang"
                      value={r.language}
                      onChange={(e) =>
                        setManualRows((rows) =>
                          rows.map((x, j) =>
                            j === i
                              ? { ...x, language: e.target.value }
                              : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-border-base bg-cream px-3 py-2 text-[13px] focus:border-forest focus:bg-paper focus:outline-none"
                    />
                    <input
                      placeholder="Notes"
                      value={r.notes}
                      onChange={(e) =>
                        setManualRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, notes: e.target.value } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-border-base bg-cream px-3 py-2 text-[13px] focus:border-forest focus:bg-paper focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setManualRows((rows) =>
                          rows.length === 1
                            ? [{ ...EMPTY_MANUAL }]
                            : rows.filter((_, j) => j !== i),
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-cream-deep hover:text-alert"
                      aria-label="Remove row"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setManualRows((rows) => [...rows, { ...EMPTY_MANUAL }])
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3.5 py-2 text-[13px] font-medium text-text hover:bg-cream-deep"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another
              </button>
            </>
          )}

          {/* PREVIEW */}
          {rawRows.length > 0 && (
            <div className="mt-8 pt-7 border-t border-border-base">
              <div className="flex items-baseline justify-between mb-4">
                <div className="font-display text-[17px] text-ink">
                  Preview
                </div>
                <div className="text-[12.5px] text-text-soft">
                  <strong className="text-ink font-medium">
                    {validated.length}
                  </strong>{" "}
                  rows ·{" "}
                  <strong className="text-ink font-medium">
                    {readyCount}
                  </strong>{" "}
                  ready ·{" "}
                  <strong className="text-ink font-medium">
                    {warnCount + excludedCount}
                  </strong>{" "}
                  need attention
                </div>
              </div>

              {/* COLUMN MAPPING */}
              {columnMap && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  {(
                    [
                      ["Name", "name"],
                      ["Email", "email"],
                      ["Phone", "phone"],
                      ["Language", "language"],
                      ["Notes (optional)", "notes"],
                    ] as const
                  ).map(([label, key]) => {
                    const src = columnMap.sourceLabels[key];
                    return (
                      <div key={key}>
                        <div className="text-[11px] uppercase tracking-[0.06em] text-text-muted font-semibold mb-1">
                          {label}
                        </div>
                        <div className="inline-block font-mono text-[12px] text-ink px-2.5 py-1 bg-paper border border-border-base rounded-md">
                          {src ?? "—"}
                        </div>
                        <div className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-success font-medium">
                          {src ? (
                            <>
                              <Check className="h-3 w-3" />
                              Mapped
                            </>
                          ) : (
                            <span className="text-text-muted">Unmapped</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PREVIEW TABLE */}
              <div className="bg-paper border border-border-base rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      {["Name", "Contact", "Lang", "Notes", "Status"].map(
                        (h) => (
                          <th
                            key={h}
                            className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map((v, i) => {
                      const rowCls = v.excludedReason
                        ? "bg-alert/[0.04]"
                        : v.warnings.length > 0
                          ? "bg-warn/[0.04]"
                          : "";
                      const nameCls = v.excludedReason
                        ? "text-alert"
                        : v.warnings.length > 0
                          ? "text-warn"
                          : "text-ink";
                      const pill = LANG_PILL[v.language];
                      return (
                        <tr
                          key={i}
                          className={`border-b border-border-soft last:border-b-0 ${rowCls}`}
                        >
                          <td
                            className={`px-3.5 py-2.5 font-medium ${nameCls}`}
                          >
                            {v.name}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-[12px] text-text-soft">
                            {v.email ?? v.phone ?? "—"}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.cls}`}
                            >
                              {pill.text}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-[12px] text-text-soft max-w-[180px] truncate">
                            {v.notes || "—"}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {v.excludedReason === "duplicate_60d" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-alert">
                                <CircleX className="h-3 w-3" />
                                Sent &lt;60d ago
                              </span>
                            ) : v.excludedReason === "no_contact" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-alert">
                                <CircleX className="h-3 w-3" />
                                No contact
                              </span>
                            ) : v.excludedReason === "opted_out" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-alert">
                                <CircleX className="h-3 w-3" />
                                Opted out
                              </span>
                            ) : v.warnings.includes("No phone") ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warn">
                                <TriangleAlert className="h-3 w-3" />
                                No phone
                              </span>
                            ) : v.warnings.includes("Unknown language") ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warn">
                                <TriangleAlert className="h-3 w-3" />
                                Lang → default
                              </span>
                            ) : (
                              <span className="text-[11px] text-success">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VALIDATION STRIP */}
              {warnCount + excludedCount > 0 && (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-3 text-[13px] text-text">
                  <TriangleAlert className="h-4 w-4 text-warn flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink font-semibold">
                      {warnCount + excludedCount} customer
                      {warnCount + excludedCount === 1 ? "" : "s"} need
                      attention.
                    </strong>{" "}
                    {warnCount > 0 &&
                      `${warnCount} sendable with a warning (e.g. email-only, language defaulted). `}
                    {excludedCount > 0 &&
                      `${excludedCount} auto-excluded (no contact, opted out, or sent in the last 60 days) — still saved with selected=off for record-keeping.`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ACTION BAR */}
      {rawRows.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-border-base bg-paper px-7 py-5">
          <div className="text-[13px] text-text-soft">
            <strong className="text-ink font-semibold">{readyCount}</strong> of{" "}
            <strong className="text-ink font-semibold">
              {validated.length}
            </strong>{" "}
            customers ready to send
            {excludedCount > 0 && (
              <>
                {" "}
                · <strong className="text-ink font-semibold">
                  {excludedCount}
                </strong>{" "}
                auto-excluded
              </>
            )}
            {error && (
              <span className="block mt-1 text-alert text-[12.5px]">
                {error}
              </span>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("draft")}
              className="rounded-lg border border-border-base bg-paper px-4 py-2.5 text-[13.5px] font-medium text-text hover:bg-cream-deep disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="button"
              disabled={pending || readyCount === 0}
              onClick={() => submit("review")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
            >
              Continue to review
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center gap-3 px-5 py-4 border-b-2 text-left transition-colors ${
        active
          ? "border-forest bg-paper text-ink"
          : "border-transparent text-text-soft hover:text-text"
      }`}
    >
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
          active
            ? "bg-forest text-cream border-forest"
            : "bg-cream text-text-soft border-border-base"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold leading-tight">
          {title}
        </span>
        <span className="block text-[11.5px] text-text-muted mt-0.5">
          {sub}
        </span>
      </span>
    </button>
  );
}
