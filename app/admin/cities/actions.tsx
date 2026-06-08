"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "+ New city page" action. Prompts for the minimum required fields
 * (slug, display name, state) inline rather than navigating to a
 * separate "new" form. Keeps the flow to one click + a small dialog.
 */
export function CityAdminActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [state, setState] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    if (!slug.trim() || !displayName.trim() || !state.trim()) {
      setError("Slug, name, and state are all required.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "city_page",
          slug: slug.trim(),
          locale: "en",
          frontmatter: {
            displayName: displayName.trim(),
            state: state.trim().toUpperCase().slice(0, 2),
            intro: "",
            whyHere: "",
            postalCode: "",
            matchNames: [displayName.trim().toLowerCase()],
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
        setError(body.error || "Couldn't create.");
        setPending(false);
        return;
      }
      router.push(`/admin/cities/${body.id}`);
    } catch {
      setError("Couldn't reach the server.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="newcity-btn"
      >
        + New city page
      </button>

      {open && (
        <div
          className="newcity-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="newcity-modal">
            <h2 className="newcity-title">New city page</h2>
            <p className="newcity-deck">
              Three fields to get started. Editorial copy lives on the
              next screen.
            </p>
            <label className="newcity-field">
              <span>Slug (URL)</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="jersey-city"
                disabled={pending}
              />
            </label>
            <label className="newcity-field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jersey City"
                disabled={pending}
              />
            </label>
            <label className="newcity-field">
              <span>State (2-letter)</span>
              <input
                type="text"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="NJ"
                disabled={pending}
              />
            </label>
            {error && <p className="newcity-error">{error}</p>}
            <div className="newcity-footer">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="newcity-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={pending}
                className="newcity-go"
              >
                {pending ? "Creating…" : "Create draft →"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .newcity-btn { background: #2D4A3A; color: #FAF7F2; border: 0; padding: 10px 18px; border-radius: 999px; font-family: 'Onest', sans-serif; font-size: 13.5px; font-weight: 500; cursor: pointer; }
        .newcity-btn:hover { background: #1F3528; }
        .newcity-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(28,28,28,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .newcity-modal { background: #FAF7F2; border-radius: 14px; padding: 26px 28px; max-width: 440px; width: 100%; box-shadow: 0 20px 40px -10px rgba(28,28,28,0.3); }
        .newcity-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 20px; color: #1c1c1c; margin: 0 0 6px; }
        .newcity-deck { font-size: 13.5px; color: #555; margin: 0 0 18px; }
        .newcity-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 12px; }
        .newcity-field > span { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; }
        .newcity-field input { font-family: 'Onest', sans-serif; font-size: 14px; padding: 9px 12px; border: 1px solid #E6DECF; border-radius: 6px; background: #FBF8F1; color: #1c1c1c; }
        .newcity-field input:focus { outline: none; border-color: #2D4A3A; box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.12); }
        .newcity-error { font-size: 12.5px; color: #842F1B; margin: 6px 0 0; padding: 8px 10px; background: rgba(132, 47, 27, 0.06); border-radius: 6px; }
        .newcity-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
        .newcity-cancel { background: transparent; border: 1px solid #E6DECF; padding: 8px 16px; border-radius: 999px; font-family: 'Onest', sans-serif; font-size: 13px; color: #555; cursor: pointer; }
        .newcity-go { background: #2D4A3A; color: #FAF7F2; border: 0; padding: 8px 16px; border-radius: 999px; font-family: 'Onest', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; }
        .newcity-go:disabled, .newcity-cancel:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </>
  );
}
