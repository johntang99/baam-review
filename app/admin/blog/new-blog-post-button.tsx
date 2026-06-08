"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "New post" button — creates a draft via POST /api/admin/content
 * then redirects the user to the editor for the new draft.
 *
 * Done client-side (rather than a form action that returns a redirect)
 * because we want immediate optimistic feedback and a single click,
 * and we don't have a meaningful intermediate "New post" form — the
 * editor itself is the form.
 */
export function NewBlogPostButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "blog_post",
          slug: `untitled-${Date.now().toString(36).slice(-6)}`,
          locale: "en",
          frontmatter: {
            title: "Untitled draft",
            description: "",
            date: new Date().toISOString().slice(0, 10),
            author: "BAAM Review Team",
            keywords: [],
          },
          body: "",
          status: "draft",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !body.id) {
        setError(body.error || "Couldn't create draft.");
        return;
      }
      router.push(`/admin/blog/${body.id}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="newpost-wrap">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="newpost-btn"
      >
        {pending ? "Creating…" : "+ New post"}
      </button>
      {error && <p className="newpost-error">{error}</p>}
      <style>{`
        .newpost-wrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
        .newpost-btn {
          background: #2D4A3A;
          color: #FAF7F2;
          border: 0;
          padding: 10px 18px;
          border-radius: 999px;
          font-family: 'Onest', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .newpost-btn:hover:not(:disabled) { background: #1F3528; }
        .newpost-btn:disabled { opacity: 0.6; cursor: default; }
        .newpost-error { font-size: 12px; color: #842F1B; margin: 0; }
      `}</style>
    </div>
  );
}
