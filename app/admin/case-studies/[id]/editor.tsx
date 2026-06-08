"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentItem } from "@/lib/admin/content";

/**
 * Case-study editor. Unlike the blog editor, this one is mostly
 * structured form fields — quote and summary are short markdown-OK
 * strings but the rest are numeric stats. No live preview pane
 * because the rendered card is a fixed layout the editor mirrors
 * inline.
 */

interface CaseStudyFm {
  businessName: string;
  vertical: string;
  city: string;
  state: string;
  monthsOnBaam: string; // string for input; coerced to number on save
  beforeRating: string;
  afterRating: string;
  beforeReviewCount: string;
  afterReviewCount: string;
  ownerName: string;
  ownerRole: string;
  quote: string;
  summary: string;
}

const VERTICAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "tcm_clinic", label: "TCM / acupuncture" },
  { value: "dental", label: "Dental" },
  { value: "legal_immigration", label: "Legal / immigration" },
  { value: "restaurant", label: "Restaurant" },
  { value: "real_estate", label: "Real estate" },
  { value: "hotel", label: "Hotel" },
  { value: "auto", label: "Auto services" },
  { value: "contractor", label: "Contractor" },
  { value: "salon_spa", label: "Salon / spa" },
  { value: "cafe", label: "Café" },
  { value: "apparel", label: "Apparel" },
  { value: "health_food", label: "Health food" },
  { value: "insurance", label: "Insurance" },
  { value: "general_smb", label: "Other local business" },
];

function fmFromItem(item: ContentItem): CaseStudyFm {
  const fm = item.frontmatter as Record<string, unknown>;
  const num = (v: unknown): string =>
    typeof v === "number" ? String(v) : (v as string) || "";
  return {
    businessName: (fm.businessName as string) ?? "",
    vertical: (fm.vertical as string) ?? "tcm_clinic",
    city: (fm.city as string) ?? "",
    state: (fm.state as string) ?? "",
    monthsOnBaam: num(fm.monthsOnBaam),
    beforeRating: num(fm.beforeRating),
    afterRating: num(fm.afterRating),
    beforeReviewCount: num(fm.beforeReviewCount),
    afterReviewCount: num(fm.afterReviewCount),
    ownerName: (fm.ownerName as string) ?? "",
    ownerRole: (fm.ownerRole as string) ?? "",
    quote: (fm.quote as string) ?? "",
    summary: (fm.summary as string) ?? "",
  };
}

function fmToFrontmatter(fm: CaseStudyFm): Record<string, unknown> {
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    businessName: fm.businessName.trim(),
    vertical: fm.vertical,
    city: fm.city.trim(),
    state: fm.state.trim().toUpperCase().slice(0, 2),
    monthsOnBaam: num(fm.monthsOnBaam),
    beforeRating: num(fm.beforeRating),
    afterRating: num(fm.afterRating),
    beforeReviewCount: num(fm.beforeReviewCount),
    afterReviewCount: num(fm.afterReviewCount),
    ownerName: fm.ownerName.trim(),
    ownerRole: fm.ownerRole.trim(),
    quote: fm.quote.trim(),
    summary: fm.summary.trim(),
  };
}

export function CaseStudyEditor({ initial }: { initial: ContentItem }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [fm, setFm] = useState<CaseStudyFm>(fmFromItem(initial));
  const [status, setStatus] = useState<"draft" | "published">(initial.status);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baselineRef = useRef({ slug, fm, status });
  const isDirty = useMemo(() => {
    const b = baselineRef.current;
    if (slug !== b.slug || status !== b.status) return true;
    return JSON.stringify(fm) !== JSON.stringify(b.fm);
  }, [slug, fm, status]);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function save(nextStatus?: "draft" | "published") {
    setError(null);
    setSaving(true);
    try {
      const finalStatus = nextStatus ?? status;
      const res = await fetch(`/api/admin/content/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          frontmatter: fmToFrontmatter(fm),
          status: finalStatus,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Save failed.");
        return;
      }
      baselineRef.current = { slug, fm, status: finalStatus };
      setStatus(finalStatus);
      setSavedAt(Date.now());
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!confirm("Delete this case study? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/content/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Delete failed.");
        setDeleting(false);
        return;
      }
      router.push("/admin/case-studies");
    } catch {
      setError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="cs-editor-header">
        <Link href="/admin/case-studies" className="cs-editor-back">
          ← Case studies
        </Link>
        <div className="cs-editor-row">
          <div>
            <h1 className="cs-editor-h1">
              {fm.businessName || "Untitled case study"}
            </h1>
            <p className="cs-editor-sub">
              <span className={`cs-editor-status cs-editor-status-${status}`}>
                {status}
              </span>
              {savedAt ? (
                <span className="cs-editor-saved">
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              ) : isDirty ? (
                <span className="cs-editor-dirty">Unsaved changes</span>
              ) : (
                <span className="cs-editor-clean">No changes</span>
              )}
            </p>
          </div>
          <div className="cs-editor-actions">
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={saving || deleting}
              className="cs-btn cs-btn-ghost"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving || deleting}
              className="cs-btn cs-btn-primary"
            >
              {status === "published" ? "Update published" : "Publish"}
            </button>
            <button
              type="button"
              onClick={destroy}
              disabled={saving || deleting}
              className="cs-btn cs-btn-danger"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </header>

      {error && <p className="cs-editor-error">{error}</p>}

      <section className="cs-section">
        <h2>Business</h2>
        <div className="cs-grid-3">
          <label className="cs-field">
            <span>Business name</span>
            <input
              type="text"
              value={fm.businessName}
              onChange={(e) =>
                setFm((p) => ({ ...p, businessName: e.target.value }))
              }
              placeholder="Modern TCM Center"
            />
          </label>
          <label className="cs-field">
            <span>Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="modern-tcm-center"
            />
          </label>
          <label className="cs-field">
            <span>Vertical</span>
            <select
              value={fm.vertical}
              onChange={(e) =>
                setFm((p) => ({ ...p, vertical: e.target.value }))
              }
            >
              {VERTICAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="cs-grid-3">
          <label className="cs-field">
            <span>City</span>
            <input
              type="text"
              value={fm.city}
              onChange={(e) => setFm((p) => ({ ...p, city: e.target.value }))}
              placeholder="Flushing"
            />
          </label>
          <label className="cs-field">
            <span>State (2-letter)</span>
            <input
              type="text"
              maxLength={2}
              value={fm.state}
              onChange={(e) => setFm((p) => ({ ...p, state: e.target.value }))}
              placeholder="NY"
            />
          </label>
          <label className="cs-field">
            <span>Months on BAAM Review</span>
            <input
              type="number"
              min={0}
              value={fm.monthsOnBaam}
              onChange={(e) =>
                setFm((p) => ({ ...p, monthsOnBaam: e.target.value }))
              }
            />
          </label>
        </div>
      </section>

      <section className="cs-section">
        <h2>Before / After stats</h2>
        <p className="cs-section-deck">
          The numbers that go in the stat grid on the published card.
          Display-formatted by the renderer.
        </p>
        <div className="cs-grid-4">
          <label className="cs-field">
            <span>Rating · before</span>
            <input
              type="number"
              step={0.1}
              min={0}
              max={5}
              value={fm.beforeRating}
              onChange={(e) =>
                setFm((p) => ({ ...p, beforeRating: e.target.value }))
              }
            />
          </label>
          <label className="cs-field">
            <span>Rating · after</span>
            <input
              type="number"
              step={0.1}
              min={0}
              max={5}
              value={fm.afterRating}
              onChange={(e) =>
                setFm((p) => ({ ...p, afterRating: e.target.value }))
              }
            />
          </label>
          <label className="cs-field">
            <span>Review count · before</span>
            <input
              type="number"
              min={0}
              value={fm.beforeReviewCount}
              onChange={(e) =>
                setFm((p) => ({ ...p, beforeReviewCount: e.target.value }))
              }
            />
          </label>
          <label className="cs-field">
            <span>Review count · after</span>
            <input
              type="number"
              min={0}
              value={fm.afterReviewCount}
              onChange={(e) =>
                setFm((p) => ({ ...p, afterReviewCount: e.target.value }))
              }
            />
          </label>
        </div>
      </section>

      <section className="cs-section">
        <h2>Owner quote</h2>
        <p className="cs-section-deck">
          A 2-3 sentence quote from the owner. Specific moments &gt; vague
          praise. This is the most-read element on the card.
        </p>
        <div className="cs-grid-2">
          <label className="cs-field">
            <span>Owner name</span>
            <input
              type="text"
              value={fm.ownerName}
              onChange={(e) =>
                setFm((p) => ({ ...p, ownerName: e.target.value }))
              }
              placeholder="Dr. Huang"
            />
          </label>
          <label className="cs-field">
            <span>Role / title</span>
            <input
              type="text"
              value={fm.ownerRole}
              onChange={(e) =>
                setFm((p) => ({ ...p, ownerRole: e.target.value }))
              }
              placeholder="Founder & licensed acupuncturist"
            />
          </label>
        </div>
        <label className="cs-field">
          <span>Quote</span>
          <textarea
            rows={4}
            value={fm.quote}
            onChange={(e) => setFm((p) => ({ ...p, quote: e.target.value }))}
            placeholder="Talk about a specific moment things changed — not a generic 'they were great' line."
          />
        </label>
      </section>

      <section className="cs-section">
        <h2>Summary</h2>
        <p className="cs-section-deck">
          3-4 sentence prose summary that appears under the quote. What was
          the problem before? What did the business do? What&apos;s true now?
        </p>
        <label className="cs-field">
          <span>Summary</span>
          <textarea
            rows={5}
            value={fm.summary}
            onChange={(e) => setFm((p) => ({ ...p, summary: e.target.value }))}
          />
        </label>
      </section>

      <style>{EDITOR_CSS}</style>
    </>
  );
}

const EDITOR_CSS = `
.cs-editor-back { font-size: 12px; color: #888; text-decoration: none; display: inline-block; margin-bottom: 12px; }
.cs-editor-back:hover { color: #1c1c1c; }
.cs-editor-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 22px; }
.cs-editor-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 28px; letter-spacing: -0.015em; color: #1c1c1c; margin: 0 0 8px; max-width: 720px; line-height: 1.15; }
.cs-editor-sub { display: flex; align-items: center; gap: 12px; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: #888; flex-wrap: wrap; }
.cs-editor-status { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.cs-editor-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.cs-editor-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.cs-editor-dirty { color: #842F1B; font-weight: 600; }
.cs-editor-saved { color: #3F5F4A; }
.cs-editor-clean { color: #888; }
.cs-editor-actions { display: flex; gap: 8px; flex-shrink: 0; }
.cs-btn { font-family: 'Onest', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 999px; cursor: pointer; border: 1px solid transparent; transition: background 0.15s; }
.cs-btn:disabled { opacity: 0.6; cursor: default; }
.cs-btn-ghost { background: #FBF8F1; color: #1c1c1c; border-color: #E6DECF; }
.cs-btn-ghost:hover:not(:disabled) { background: #F4EFE2; }
.cs-btn-primary { background: #2D4A3A; color: #FAF7F2; }
.cs-btn-primary:hover:not(:disabled) { background: #1F3528; }
.cs-btn-danger { background: transparent; color: #842F1B; border-color: rgba(132, 47, 27, 0.3); }
.cs-btn-danger:hover:not(:disabled) { background: rgba(132, 47, 27, 0.08); }

.cs-editor-error { padding: 10px 14px; background: rgba(132, 47, 27, 0.08); border: 1px solid rgba(132, 47, 27, 0.25); border-radius: 8px; color: #842F1B; font-size: 13px; margin: 0 0 18px; }

.cs-section { background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; padding: 22px 24px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 14px; }
.cs-section h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; margin: 0; color: #1c1c1c; }
.cs-section-deck { font-size: 13px; color: #555; margin: 0; }

.cs-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cs-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.cs-grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .cs-grid-2, .cs-grid-3, .cs-grid-4 { grid-template-columns: 1fr; } }

.cs-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.cs-field > span:first-child { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; }
.cs-field input, .cs-field textarea, .cs-field select { font-family: 'Onest', sans-serif; font-size: 14px; padding: 9px 12px; border: 1px solid #E6DECF; border-radius: 6px; background: #FAF7F2; color: #1c1c1c; width: 100%; }
.cs-field textarea { resize: vertical; line-height: 1.55; }
.cs-field input:focus, .cs-field textarea:focus, .cs-field select:focus { outline: none; border-color: #2D4A3A; box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.12); }
`;
