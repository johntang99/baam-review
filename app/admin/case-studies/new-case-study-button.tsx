"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewCaseStudyButton() {
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
          kind: "case_study",
          slug: `untitled-${Date.now().toString(36).slice(-6)}`,
          locale: "en",
          frontmatter: {
            businessName: "",
            vertical: "tcm_clinic",
            city: "",
            state: "",
            monthsOnBaam: 0,
            beforeRating: 0,
            afterRating: 0,
            beforeReviewCount: 0,
            afterReviewCount: 0,
            ownerName: "",
            ownerRole: "",
            quote: "",
            summary: "",
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
        setError(body.error || "Couldn't create case study.");
        return;
      }
      router.push(`/admin/case-studies/${body.id}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="newcs-wrap">
      <button type="button" onClick={create} disabled={pending} className="newcs-btn">
        {pending ? "Creating…" : "+ New case study"}
      </button>
      {error && <p className="newcs-error">{error}</p>}
      <style>{`
        .newcs-wrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
        .newcs-btn { background: #2D4A3A; color: #FAF7F2; border: 0; padding: 10px 18px; border-radius: 999px; font-family: 'Onest', sans-serif; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
        .newcs-btn:hover:not(:disabled) { background: #1F3528; }
        .newcs-btn:disabled { opacity: 0.6; cursor: default; }
        .newcs-error { font-size: 12px; color: #842F1B; margin: 0; }
      `}</style>
    </div>
  );
}
