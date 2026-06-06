"use client";

import { useState, useTransition } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { setAuditPublic } from "@/app/audit/actions";

interface OpenAccessToggleProps {
  auditId: string;
  initialIsPublic: boolean;
  /** Full shareable URL — passed in from the server so we don't have to
   *  guess origin client-side (origin can be wrong on previews / proxied
   *  environments). */
  shareUrl: string;
}

/** Owner-only control for each row in /audit/list. The checkbox flips
 *  audits.is_public via the setAuditPublic server action (RLS scopes to
 *  the owner). When checked, the inline "Copy link" button surfaces so
 *  the owner can paste the shareable URL straight into Slack / email. */
export function OpenAccessToggle({
  auditId,
  initialIsPublic,
  shareUrl,
}: OpenAccessToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setError(null);
    setIsPublic(next); // optimistic
    startTransition(async () => {
      const res = await setAuditPublic(auditId, next);
      if (!res.ok) {
        setIsPublic(!next); // revert
        setError(res.error ?? "Couldn't update.");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy.");
    }
  }

  return (
    <div className="open-access-toggle">
      <label className="open-access-toggle-label">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => toggle(e.target.checked)}
          disabled={pending}
          className="open-access-toggle-checkbox"
          aria-label="Open access — anyone with the link can view"
        />
        <span className="open-access-toggle-text">Open</span>
      </label>
      {isPublic && (
        <button
          type="button"
          onClick={copy}
          className="open-access-copy-btn"
          aria-label="Copy share link"
          title={shareUrl}
        >
          {copied ? (
            <>
              <Check className="open-access-icon" />
              Copied
            </>
          ) : (
            <>
              <LinkIcon className="open-access-icon" />
              Copy link
            </>
          )}
        </button>
      )}
      {error && <span className="open-access-error">{error}</span>}
      <style jsx>{`
        .open-access-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .open-access-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--text-soft, #555);
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid var(--rule, #ddd);
          background: var(--paper, #fff);
        }
        .open-access-toggle-label:hover {
          background: var(--cream-deep, #f4efe2);
        }
        .open-access-toggle-checkbox {
          width: 14px;
          height: 14px;
          accent-color: var(--forest, #2d4a3a);
          cursor: pointer;
        }
        .open-access-toggle-checkbox:disabled {
          cursor: wait;
          opacity: 0.6;
        }
        .open-access-toggle-text { color: var(--ink, #1c1c1c); }
        .open-access-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--rule, #ddd);
          background: var(--paper, #fff);
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text-soft, #555);
          cursor: pointer;
          font-family: inherit;
        }
        .open-access-copy-btn:hover {
          color: var(--ink, #1c1c1c);
          border-color: var(--ink, #1c1c1c);
        }
        :global(.open-access-icon) {
          width: 11px;
          height: 11px;
        }
        .open-access-error {
          font-size: 11.5px;
          color: #a4452a;
        }
      `}</style>
    </div>
  );
}
