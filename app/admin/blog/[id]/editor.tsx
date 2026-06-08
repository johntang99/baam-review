"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ContentItem } from "@/lib/admin/content";

/**
 * Blog post editor — markdown source on the left, live preview on the
 * right, frontmatter as structured form fields above both panes.
 *
 * Auto-save discipline: this editor does NOT auto-save on every
 * keystroke. Auto-save plus database round trips creates surprises
 * (lost focus, flicker, race conditions with the publish toggle).
 * Instead we mark the row dirty as the user types and require an
 * explicit "Save draft" or "Publish" click. The dirty flag warns on
 * navigation so unsaved work doesn't quietly disappear.
 */

interface BlogPostEditorProps {
  initial: ContentItem;
}

interface Frontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  authorUrl: string;
  keywords: string;
  image: string;
}

function fmFromItem(item: ContentItem): Frontmatter {
  const fm = item.frontmatter as Record<string, unknown>;
  const keywords = Array.isArray(fm.keywords)
    ? (fm.keywords as string[]).join(", ")
    : typeof fm.keywords === "string"
      ? (fm.keywords as string)
      : "";
  return {
    title: (fm.title as string) ?? "",
    description: (fm.description as string) ?? "",
    date: (fm.date as string) ?? "",
    author: (fm.author as string) ?? "",
    authorUrl: (fm.authorUrl as string) ?? "",
    keywords,
    image: (fm.image as string) ?? "",
  };
}

function fmToFrontmatter(fm: Frontmatter): Record<string, unknown> {
  return {
    title: fm.title.trim(),
    description: fm.description.trim(),
    date: fm.date.trim(),
    author: fm.author.trim() || "BAAM Review Team",
    authorUrl: fm.authorUrl.trim() || undefined,
    keywords: fm.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    image: fm.image.trim() || undefined,
  };
}

export function BlogPostEditor({ initial }: BlogPostEditorProps) {
  const router = useRouter();

  const [slug, setSlug] = useState(initial.slug);
  const [locale, setLocale] = useState<"en" | "zh">(initial.locale);
  const [fm, setFm] = useState<Frontmatter>(fmFromItem(initial));
  const [body, setBody] = useState(initial.body);
  const [status, setStatus] = useState<"draft" | "published">(initial.status);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dirty-tracking baseline. Snapshot the props once on mount so we
  // can compare against the live form to know whether there are
  // unsaved changes. After a successful save we re-snapshot.
  const baselineRef = useRef({
    slug: initial.slug,
    locale: initial.locale,
    fm: fmFromItem(initial),
    body: initial.body,
    status: initial.status,
  });

  const isDirty = useMemo(() => {
    const b = baselineRef.current;
    if (slug !== b.slug) return true;
    if (locale !== b.locale) return true;
    if (status !== b.status) return true;
    if (body !== b.body) return true;
    return (
      fm.title !== b.fm.title ||
      fm.description !== b.fm.description ||
      fm.date !== b.fm.date ||
      fm.author !== b.fm.author ||
      fm.authorUrl !== b.fm.authorUrl ||
      fm.keywords !== b.fm.keywords ||
      fm.image !== b.fm.image
    );
  }, [slug, locale, fm, body, status]);

  // Warn before unload if there are unsaved changes.
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
          locale,
          frontmatter: fmToFrontmatter(fm),
          body,
          status: finalStatus,
        }),
      });
      const responseBody = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(responseBody.error || "Save failed.");
        return;
      }
      // Re-snapshot baseline and confirm.
      baselineRef.current = { slug, locale, fm, body, status: finalStatus };
      setStatus(finalStatus);
      setSavedAt(Date.now());
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!confirm("Delete this post permanently? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/content/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error || "Delete failed.");
        setDeleting(false);
        return;
      }
      router.push("/admin/blog");
    } catch {
      setError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="editor-header">
        <Link href="/admin/blog" className="editor-back">
          ← Blog posts
        </Link>
        <div className="editor-header-row">
          <div>
            <h1 className="editor-h1">{fm.title || "Untitled draft"}</h1>
            <p className="editor-sub">
              <span
                className={`editor-status editor-status-${status}`}
              >
                {status}
              </span>
              {savedAt ? (
                <span className="editor-saved">
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              ) : isDirty ? (
                <span className="editor-dirty">Unsaved changes</span>
              ) : (
                <span className="editor-clean">No changes</span>
              )}
              <Link
                href={`/blog/${slug}`}
                target="_blank"
                rel="noopener"
                className="editor-preview-link"
              >
                Preview at /blog/{slug} ↗
              </Link>
            </p>
          </div>
          <div className="editor-actions">
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={saving || deleting}
              className="editor-btn editor-btn-ghost"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving || deleting}
              className="editor-btn editor-btn-primary"
            >
              {status === "published" ? "Update published" : "Publish"}
            </button>
            <button
              type="button"
              onClick={destroy}
              disabled={saving || deleting}
              className="editor-btn editor-btn-danger"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </header>

      {error && <p className="editor-error">{error}</p>}

      <section className="editor-fm">
        <div className="editor-fm-row">
          <label className="editor-field">
            <span>Title</span>
            <input
              type="text"
              value={fm.title}
              onChange={(e) => setFm((f) => ({ ...f, title: e.target.value }))}
              placeholder="The reputation report you've been missing"
            />
          </label>
          <label className="editor-field" style={{ maxWidth: 220 }}>
            <span>Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="reputation-report"
            />
          </label>
        </div>

        <label className="editor-field">
          <span>Description (meta + social)</span>
          <textarea
            rows={2}
            value={fm.description}
            onChange={(e) =>
              setFm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="One sentence that would convince a busy owner to click. Under 155 characters."
          />
          <span className="editor-helper">
            {fm.description.length}/155 characters
          </span>
        </label>

        <div className="editor-fm-row">
          <label className="editor-field">
            <span>Date</span>
            <input
              type="date"
              value={fm.date}
              onChange={(e) => setFm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label className="editor-field">
            <span>Locale</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as "en" | "zh")}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
          <label className="editor-field">
            <span>Author</span>
            <input
              type="text"
              value={fm.author}
              onChange={(e) => setFm((f) => ({ ...f, author: e.target.value }))}
              placeholder="Your name"
            />
          </label>
        </div>

        <div className="editor-fm-row">
          <label className="editor-field">
            <span>Keywords (comma-separated)</span>
            <input
              type="text"
              value={fm.keywords}
              onChange={(e) =>
                setFm((f) => ({ ...f, keywords: e.target.value }))
              }
              placeholder="reviews, google, dental"
            />
          </label>
          <label className="editor-field">
            <span>OG image URL</span>
            <input
              type="text"
              value={fm.image}
              onChange={(e) => setFm((f) => ({ ...f, image: e.target.value }))}
              placeholder="/og/my-post.png"
            />
          </label>
        </div>
      </section>

      <section className="editor-grid">
        <div className="editor-pane">
          <div className="editor-pane-label">Markdown source</div>
          <textarea
            className="editor-source"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck
            placeholder="# Start writing…"
          />
        </div>
        <div className="editor-pane">
          <div className="editor-pane-label">Preview</div>
          <div className="editor-preview">
            {body.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="editor-preview-empty">
                Preview updates as you type.
              </p>
            )}
          </div>
        </div>
      </section>

      <style>{EDITOR_CSS}</style>
    </>
  );
}

const EDITOR_CSS = `
.editor-back {
  font-size: 12px;
  color: #888;
  text-decoration: none;
  display: inline-block;
  margin-bottom: 12px;
}
.editor-back:hover { color: #1c1c1c; }
.editor-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.editor-h1 {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 28px;
  letter-spacing: -0.015em;
  color: #1c1c1c;
  margin: 0 0 8px;
  max-width: 720px;
  line-height: 1.15;
}
.editor-sub {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: #888;
  flex-wrap: wrap;
}
.editor-status {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}
.editor-status-published {
  background: rgba(107, 142, 110, 0.15);
  color: #3F5F4A;
}
.editor-status-draft {
  background: rgba(201, 169, 97, 0.18);
  color: #6F5320;
}
.editor-dirty { color: #842F1B; font-weight: 600; }
.editor-saved { color: #3F5F4A; }
.editor-clean { color: #888; }
.editor-preview-link {
  color: #2D4A3A;
  text-decoration: none;
  font-family: 'Onest', sans-serif;
  font-size: 12px;
  margin-left: auto;
}
.editor-preview-link:hover { text-decoration: underline; }

.editor-actions { display: flex; gap: 8px; flex-shrink: 0; }
.editor-btn {
  font-family: 'Onest', sans-serif;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}
.editor-btn:disabled { opacity: 0.6; cursor: default; }
.editor-btn-ghost {
  background: #FBF8F1;
  color: #1c1c1c;
  border-color: #E6DECF;
}
.editor-btn-ghost:hover:not(:disabled) { background: #F4EFE2; }
.editor-btn-primary {
  background: #2D4A3A;
  color: #FAF7F2;
}
.editor-btn-primary:hover:not(:disabled) { background: #1F3528; }
.editor-btn-danger {
  background: transparent;
  color: #842F1B;
  border-color: rgba(132, 47, 27, 0.3);
}
.editor-btn-danger:hover:not(:disabled) { background: rgba(132, 47, 27, 0.08); }

.editor-error {
  padding: 10px 14px;
  background: rgba(132, 47, 27, 0.08);
  border: 1px solid rgba(132, 47, 27, 0.25);
  border-radius: 8px;
  color: #842F1B;
  font-size: 13px;
  margin: 0 0 18px;
}

.editor-fm {
  background: #FBF8F1;
  border: 1px solid #E6DECF;
  border-radius: 12px;
  padding: 22px;
  margin-bottom: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.editor-fm-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
@media (max-width: 760px) { .editor-fm-row { grid-template-columns: 1fr; } }
.editor-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.editor-field > span:first-child {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #888;
  font-weight: 600;
}
.editor-field input,
.editor-field textarea,
.editor-field select {
  font-family: 'Onest', sans-serif;
  font-size: 14px;
  padding: 9px 12px;
  border: 1px solid #E6DECF;
  border-radius: 6px;
  background: #FAF7F2;
  color: #1c1c1c;
  width: 100%;
}
.editor-field textarea { resize: vertical; min-height: 60px; line-height: 1.5; }
.editor-field input:focus, .editor-field textarea:focus, .editor-field select:focus {
  outline: none;
  border-color: #2D4A3A;
  box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.12);
}
.editor-helper {
  font-size: 11px;
  color: #888;
  font-style: italic;
}

.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 980px) { .editor-grid { grid-template-columns: 1fr; } }
.editor-pane {
  background: #FBF8F1;
  border: 1px solid #E6DECF;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 480px;
}
.editor-pane-label {
  padding: 12px 18px;
  background: #F4EFE2;
  border-bottom: 1px solid #E6DECF;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #888;
  font-weight: 600;
}
.editor-source {
  flex: 1;
  border: 0;
  padding: 18px 22px;
  background: transparent;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  line-height: 1.6;
  color: #1c1c1c;
  resize: none;
  outline: none;
}
.editor-preview {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  font-family: 'Newsreader', Georgia, serif;
  font-size: 15.5px;
  line-height: 1.65;
  color: #2a2a2a;
}
.editor-preview h1 {
  font-family: 'Fraunces', serif;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.012em;
  color: #1c1c1c;
  margin: 0 0 14px;
}
.editor-preview h2 {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 500;
  margin: 24px 0 10px;
  color: #1c1c1c;
}
.editor-preview h3 {
  font-family: 'Fraunces', serif;
  font-size: 17px;
  font-weight: 500;
  margin: 18px 0 8px;
  color: #1c1c1c;
}
.editor-preview p { margin: 0 0 14px; }
.editor-preview a { color: #2D4A3A; text-decoration: underline; }
.editor-preview ul, .editor-preview ol { padding-left: 22px; margin: 0 0 14px; }
.editor-preview li { margin-bottom: 4px; }
.editor-preview blockquote {
  border-left: 3px solid #C9A961;
  padding-left: 14px;
  margin: 14px 0;
  font-style: italic;
  color: #555;
}
.editor-preview code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  background: #F4EFE2;
  padding: 2px 5px;
  border-radius: 3px;
}
.editor-preview pre {
  background: #1c1c1c;
  color: #FAF7F2;
  padding: 14px 18px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12.5px;
}
.editor-preview pre code { background: transparent; color: inherit; padding: 0; }
.editor-preview table { width: 100%; border-collapse: collapse; margin: 14px 0; font-family: 'Onest', sans-serif; font-size: 13px; }
.editor-preview th, .editor-preview td { padding: 8px 12px; border-bottom: 1px solid #E6DECF; text-align: left; }
.editor-preview th { background: #F4EFE2; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.editor-preview-empty { font-style: italic; color: #888; }
`;
