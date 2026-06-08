"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ContentItem } from "@/lib/admin/content";
import type { MarketingPageDef } from "@/lib/seo/marketing-pages";

/**
 * Marketing page editor — renders a form whose fields are driven by
 * the page's MarketingPageDef. No body/markdown blob — all content is
 * structured per field.
 */
export function MarketingPageEditor({
  def,
  initial,
}: {
  def: MarketingPageDef;
  initial: ContentItem;
}) {
  const initialFm = useMemo(
    () => (initial.frontmatter as Record<string, string>) ?? {},
    [initial.frontmatter],
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Seed with empty strings for any defined field that's missing in
    // the stored frontmatter so the form is always controlled.
    const out: Record<string, string> = {};
    for (const f of def.fields) out[f.key] = (initialFm[f.key] as string) ?? "";
    return out;
  });
  const [status, setStatus] = useState<"draft" | "published">(initial.status);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baselineRef = useRef({ values: { ...values }, status });
  const isDirty = useMemo(() => {
    const b = baselineRef.current;
    if (status !== b.status) return true;
    for (const key of Object.keys(values)) {
      if (values[key] !== b.values[key]) return true;
    }
    return false;
  }, [values, status]);

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
          frontmatter: values,
          status: finalStatus,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Save failed.");
        return;
      }
      baselineRef.current = { values: { ...values }, status: finalStatus };
      setStatus(finalStatus);
      setSavedAt(Date.now());
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="mp-header">
        <Link href="/admin/marketing" className="mp-back">
          ← Marketing pages
        </Link>
        <div className="mp-row">
          <div>
            <h1 className="mp-h1">{def.displayName}</h1>
            <p className="mp-sub">
              <span className={`mp-status mp-status-${status}`}>{status}</span>
              {savedAt ? (
                <span className="mp-saved">
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              ) : isDirty ? (
                <span className="mp-dirty">Unsaved changes</span>
              ) : (
                <span className="mp-clean">No changes</span>
              )}
              <Link
                href={def.path}
                target="_blank"
                rel="noopener"
                className="mp-preview-link"
              >
                View at {def.path} ↗
              </Link>
            </p>
          </div>
          <div className="mp-actions">
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={saving}
              className="mp-btn mp-btn-ghost"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving}
              className="mp-btn mp-btn-primary"
            >
              {status === "published" ? "Update published" : "Publish"}
            </button>
          </div>
        </div>
        <p className="mp-deck">{def.description}</p>
      </header>

      {error && <p className="mp-error">{error}</p>}

      <section className="mp-fields">
        {def.fields.map((field) => {
          const value = values[field.key] ?? "";
          const setValue = (v: string) =>
            setValues((p) => ({ ...p, [field.key]: v }));
          return (
            <div key={field.key} className="mp-field">
              <label className="mp-label">
                <span className="mp-label-text">{field.label}</span>
                <span className="mp-label-kind">{field.kind}</span>
              </label>
              {field.hint && <p className="mp-hint">{field.hint}</p>}

              {field.kind === "text" && (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              {field.kind === "textarea" && (
                <textarea
                  rows={field.rows ?? 3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              {field.kind === "html" && (
                <textarea
                  rows={field.rows ?? 3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mp-mono"
                />
              )}
              {field.kind === "markdown" && (
                <div className="mp-md-grid">
                  <textarea
                    rows={field.rows ?? 6}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mp-mono"
                  />
                  <div className="mp-md-preview">
                    {value.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {value}
                      </ReactMarkdown>
                    ) : (
                      <p className="mp-md-empty">Preview updates as you type.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <style>{EDITOR_CSS}</style>
    </>
  );
}

const EDITOR_CSS = `
.mp-back { font-size: 12px; color: #888; text-decoration: none; display: inline-block; margin-bottom: 12px; }
.mp-back:hover { color: #1c1c1c; }
.mp-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 14px; }
.mp-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 28px; letter-spacing: -0.015em; color: #1c1c1c; margin: 0 0 8px; max-width: 720px; line-height: 1.15; }
.mp-sub { display: flex; align-items: center; gap: 12px; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: #888; flex-wrap: wrap; }
.mp-status { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.mp-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.mp-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.mp-dirty { color: #842F1B; font-weight: 600; }
.mp-saved { color: #3F5F4A; }
.mp-clean { color: #888; }
.mp-preview-link { color: #2D4A3A; text-decoration: none; font-family: 'Onest', sans-serif; font-size: 12px; margin-left: auto; }
.mp-preview-link:hover { text-decoration: underline; }
.mp-actions { display: flex; gap: 8px; flex-shrink: 0; }
.mp-btn { font-family: 'Onest', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 999px; cursor: pointer; border: 1px solid transparent; transition: background 0.15s; }
.mp-btn:disabled { opacity: 0.6; cursor: default; }
.mp-btn-ghost { background: #FBF8F1; color: #1c1c1c; border-color: #E6DECF; }
.mp-btn-ghost:hover:not(:disabled) { background: #F4EFE2; }
.mp-btn-primary { background: #2D4A3A; color: #FAF7F2; }
.mp-btn-primary:hover:not(:disabled) { background: #1F3528; }
.mp-deck { font-size: 13px; color: #555; margin: 8px 0 0; max-width: 620px; }
.mp-error { padding: 10px 14px; background: rgba(132, 47, 27, 0.08); border: 1px solid rgba(132, 47, 27, 0.25); border-radius: 8px; color: #842F1B; font-size: 13px; margin: 0 0 18px; }
.mp-fields { display: flex; flex-direction: column; gap: 16px; }
.mp-field { background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; padding: 18px 22px; display: flex; flex-direction: column; gap: 10px; }
.mp-label { display: flex; gap: 10px; align-items: baseline; }
.mp-label-text { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; }
.mp-label-kind { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #6F5320; background: rgba(201, 169, 97, 0.15); padding: 2px 6px; border-radius: 999px; }
.mp-hint { font-size: 12px; color: #888; font-style: italic; margin: -4px 0 0; }
.mp-field input, .mp-field textarea { font-family: 'Onest', sans-serif; font-size: 14px; padding: 9px 12px; border: 1px solid #E6DECF; border-radius: 6px; background: #FAF7F2; color: #1c1c1c; width: 100%; line-height: 1.55; resize: vertical; }
.mp-field input:focus, .mp-field textarea:focus { outline: none; border-color: #2D4A3A; box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.12); }
.mp-mono { font-family: 'JetBrains Mono', monospace !important; font-size: 13px !important; }
.mp-md-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 820px) { .mp-md-grid { grid-template-columns: 1fr; } }
.mp-md-preview { background: #FAF7F2; border: 1px solid #E6DECF; border-radius: 6px; padding: 14px 18px; font-family: 'Newsreader', Georgia, serif; font-size: 14.5px; line-height: 1.6; color: #2a2a2a; max-height: 320px; overflow-y: auto; }
.mp-md-empty { color: #888; font-style: italic; }
.mp-md-preview h2, .mp-md-preview h3 { font-family: 'Fraunces', serif; font-weight: 500; margin: 12px 0 6px; }
.mp-md-preview p { margin: 0 0 10px; }
`;
