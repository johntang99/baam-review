"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentItem } from "@/lib/admin/content";

/**
 * City-page editor. The two long-form fields (`intro`, `whyHere`) are
 * the entire editorial content — everything else on the public page
 * is auto-generated from the audit data. matchNames is a power-user
 * field controlling which audit records map to this city.
 */

interface CityFm {
  displayName: string;
  state: string;
  postalCode: string;
  matchNames: string;
  intro: string;
  whyHere: string;
}

function fmFromItem(item: ContentItem): CityFm {
  const fm = item.frontmatter as Record<string, unknown>;
  const matchNames = Array.isArray(fm.matchNames)
    ? (fm.matchNames as string[]).join(", ")
    : "";
  return {
    displayName: (fm.displayName as string) ?? "",
    state: (fm.state as string) ?? "",
    postalCode: (fm.postalCode as string) ?? "",
    matchNames,
    intro: (fm.intro as string) ?? "",
    whyHere: (fm.whyHere as string) ?? "",
  };
}

function fmToFrontmatter(fm: CityFm): Record<string, unknown> {
  return {
    displayName: fm.displayName.trim(),
    state: fm.state.trim().toUpperCase().slice(0, 2),
    postalCode: fm.postalCode.trim() || undefined,
    matchNames: fm.matchNames
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    intro: fm.intro.trim(),
    whyHere: fm.whyHere.trim(),
  };
}

export function CityPageEditor({ initial }: { initial: ContentItem }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [fm, setFm] = useState<CityFm>(fmFromItem(initial));
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
    if (
      !confirm(
        "Delete this city's editorial overrides? The page will fall back to whatever's in lib/seo/cities.ts (if anything).",
      )
    )
      return;
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
      router.push("/admin/cities");
    } catch {
      setError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="cy-header">
        <Link href="/admin/cities" className="cy-back">
          ← City pages
        </Link>
        <div className="cy-row">
          <div>
            <h1 className="cy-h1">
              {fm.displayName || slug} {fm.state && `· ${fm.state}`}
            </h1>
            <p className="cy-sub">
              <span className={`cy-status cy-status-${status}`}>{status}</span>
              {savedAt ? (
                <span className="cy-saved">
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              ) : isDirty ? (
                <span className="cy-dirty">Unsaved changes</span>
              ) : (
                <span className="cy-clean">No changes</span>
              )}
              <Link
                href={`/local/${slug}`}
                target="_blank"
                rel="noopener"
                className="cy-preview-link"
              >
                View at /local/{slug} ↗
              </Link>
            </p>
          </div>
          <div className="cy-actions">
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={saving || deleting}
              className="cy-btn cy-btn-ghost"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving || deleting}
              className="cy-btn cy-btn-primary"
            >
              {status === "published" ? "Update published" : "Publish"}
            </button>
            <button
              type="button"
              onClick={destroy}
              disabled={saving || deleting}
              className="cy-btn cy-btn-danger"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </header>

      {error && <p className="cy-error">{error}</p>}

      <section className="cy-section">
        <h2>Basics</h2>
        <div className="cy-grid-3">
          <label className="cy-field">
            <span>Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label className="cy-field">
            <span>Display name</span>
            <input
              type="text"
              value={fm.displayName}
              onChange={(e) =>
                setFm((p) => ({ ...p, displayName: e.target.value }))
              }
            />
          </label>
          <label className="cy-field">
            <span>State</span>
            <input
              type="text"
              maxLength={2}
              value={fm.state}
              onChange={(e) => setFm((p) => ({ ...p, state: e.target.value }))}
            />
          </label>
        </div>
        <div className="cy-grid-2">
          <label className="cy-field">
            <span>Postal code (optional)</span>
            <input
              type="text"
              value={fm.postalCode}
              onChange={(e) =>
                setFm((p) => ({ ...p, postalCode: e.target.value }))
              }
              placeholder="11354"
            />
          </label>
          <label className="cy-field">
            <span>Match names (comma-separated)</span>
            <input
              type="text"
              value={fm.matchNames}
              onChange={(e) =>
                setFm((p) => ({ ...p, matchNames: e.target.value }))
              }
              placeholder="flushing, flushing queens, flushing, ny"
            />
          </label>
        </div>
        <p className="cy-helper">
          Match names control which audit records get associated with this
          city. Lowercased + trimmed before comparison.
        </p>
      </section>

      <section className="cy-section">
        <h2>Editorial copy</h2>
        <p className="cy-section-deck">
          The hand-written intro paragraph + the &quot;why this market matters
          to BAAM&quot; block are the only editorial fields on the public page
          — everything else is auto-generated from audit data.
        </p>
        <label className="cy-field">
          <span>Intro (1-2 sentences under the hero)</span>
          <textarea
            rows={3}
            value={fm.intro}
            onChange={(e) => setFm((p) => ({ ...p, intro: e.target.value }))}
            placeholder="Review marketing for local businesses in [city]. We've audited the bilingual TCM, dental, and salon market here more than anywhere else."
          />
        </label>
        <label className="cy-field">
          <span>Why here (~80 words, voice of founder)</span>
          <textarea
            rows={6}
            value={fm.whyHere}
            onChange={(e) =>
              setFm((p) => ({ ...p, whyHere: e.target.value }))
            }
            placeholder="What makes this market important. Specific to local culture, competition, languages, verticals. Keep it personal — Google rewards unique copy over boilerplate."
          />
        </label>
      </section>

      <style>{EDITOR_CSS}</style>
    </>
  );
}

const EDITOR_CSS = `
.cy-back { font-size: 12px; color: #888; text-decoration: none; display: inline-block; margin-bottom: 12px; }
.cy-back:hover { color: #1c1c1c; }
.cy-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 22px; }
.cy-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 28px; letter-spacing: -0.015em; color: #1c1c1c; margin: 0 0 8px; max-width: 720px; line-height: 1.15; }
.cy-sub { display: flex; align-items: center; gap: 12px; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: #888; flex-wrap: wrap; }
.cy-status { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.cy-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.cy-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.cy-dirty { color: #842F1B; font-weight: 600; }
.cy-saved { color: #3F5F4A; }
.cy-clean { color: #888; }
.cy-preview-link { color: #2D4A3A; text-decoration: none; font-family: 'Onest', sans-serif; font-size: 12px; margin-left: auto; }
.cy-preview-link:hover { text-decoration: underline; }
.cy-actions { display: flex; gap: 8px; flex-shrink: 0; }
.cy-btn { font-family: 'Onest', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 999px; cursor: pointer; border: 1px solid transparent; transition: background 0.15s; }
.cy-btn:disabled { opacity: 0.6; cursor: default; }
.cy-btn-ghost { background: #FBF8F1; color: #1c1c1c; border-color: #E6DECF; }
.cy-btn-ghost:hover:not(:disabled) { background: #F4EFE2; }
.cy-btn-primary { background: #2D4A3A; color: #FAF7F2; }
.cy-btn-primary:hover:not(:disabled) { background: #1F3528; }
.cy-btn-danger { background: transparent; color: #842F1B; border-color: rgba(132, 47, 27, 0.3); }
.cy-btn-danger:hover:not(:disabled) { background: rgba(132, 47, 27, 0.08); }
.cy-error { padding: 10px 14px; background: rgba(132, 47, 27, 0.08); border: 1px solid rgba(132, 47, 27, 0.25); border-radius: 8px; color: #842F1B; font-size: 13px; margin: 0 0 18px; }
.cy-section { background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; padding: 22px 24px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 14px; }
.cy-section h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; margin: 0; color: #1c1c1c; }
.cy-section-deck { font-size: 13px; color: #555; margin: 0; }
.cy-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cy-grid-3 { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 14px; }
@media (max-width: 760px) { .cy-grid-2, .cy-grid-3 { grid-template-columns: 1fr; } }
.cy-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.cy-field > span:first-child { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; }
.cy-field input, .cy-field textarea { font-family: 'Onest', sans-serif; font-size: 14px; padding: 9px 12px; border: 1px solid #E6DECF; border-radius: 6px; background: #FAF7F2; color: #1c1c1c; width: 100%; }
.cy-field textarea { resize: vertical; line-height: 1.55; }
.cy-field input:focus, .cy-field textarea:focus { outline: none; border-color: #2D4A3A; box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.12); }
.cy-helper { font-size: 11.5px; color: #888; font-style: italic; margin: 0; }
`;
