"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, HelpCircle, Link as LinkIcon, X } from "lucide-react";
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
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!showHelp) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowHelp(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp]);

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
          aria-label="Share Report — anyone with the link can view"
        />
        <span className="open-access-toggle-text">Share Report</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowHelp(true);
          }}
          className="open-access-help-btn"
          aria-label="What does 'Share Report' do?"
          title="What does 'Share Report' do?"
        >
          <HelpCircle className="open-access-icon" />
        </button>
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

      {showHelp && (
        <div
          className="open-access-help-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-access-help-title"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="open-access-help-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="open-access-help-header">
              <h3
                id="open-access-help-title"
                className="open-access-help-title"
              >
                Share Report — what does it do?
              </h3>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="open-access-help-close"
                aria-label="Close"
              >
                <X className="open-access-help-close-icon" />
              </button>
            </div>
            <div className="open-access-help-body">
              <p>
                <strong>Share Report</strong> makes <em>this one audit</em> viewable
                by anyone who has the link &mdash; no signin required. Useful
                when you want to share a report with a client, prospect, or
                colleague who doesn&apos;t have a BAAM Review account.
              </p>
              <ul className="open-access-help-list">
                <li>
                  Check the box, then use <strong>Copy link</strong> to grab
                  the shareable URL.
                </li>
                <li>
                  Uncheck the box at any time &mdash; anonymous access is
                  revoked immediately.
                </li>
                <li>
                  Your other audits stay private. Sharing one doesn&apos;t
                  expose any of the others.
                </li>
                <li>
                  The URL itself is the secret. Don&apos;t post it anywhere
                  truly public if you wouldn&apos;t want a stranger to read
                  the report.
                </li>
              </ul>
            </div>
            <div className="open-access-help-footer">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="open-access-help-done-btn"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .open-access-toggle {
          display: inline-flex;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
        }
        .open-access-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--text-soft, #555);
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 8px;
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
        .open-access-toggle-text { color: var(--ink, #1c1c1c); margin-right: auto; }
        .open-access-copy-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid var(--rule, #ddd);
          background: var(--paper, #fff);
          font-size: 12px;
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
        .open-access-help-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin-left: 2px;
          border: 0;
          background: transparent;
          color: var(--text-muted, #888);
          cursor: pointer;
          line-height: 0;
        }
        .open-access-help-btn:hover { color: var(--ink, #1c1c1c); }

        .open-access-help-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(28, 28, 28, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: open-access-fade 160ms ease-out;
          font-family: inherit;
        }
        @keyframes open-access-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .open-access-help-card {
          width: 100%;
          max-width: 480px;
          background: var(--paper, #faf7f2);
          border-radius: 14px;
          box-shadow: 0 24px 56px -20px rgba(28, 28, 28, 0.35);
          overflow: hidden;
        }
        .open-access-help-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid var(--rule, #ddd);
        }
        .open-access-help-title {
          margin: 0;
          font-family: 'Fraunces', 'Instrument Serif', serif;
          font-size: 18px;
          font-weight: 500;
          color: var(--ink, #1c1c1c);
        }
        .open-access-help-close {
          background: none;
          border: 0;
          padding: 4px;
          line-height: 0;
          color: var(--text-muted, #888);
          cursor: pointer;
        }
        .open-access-help-close:hover { color: var(--ink, #1c1c1c); }
        :global(.open-access-help-close-icon) {
          width: 16px;
          height: 16px;
        }
        .open-access-help-body {
          padding: 18px 22px 4px;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--text, #2a2a2a);
        }
        .open-access-help-body p { margin: 0 0 12px; }
        .open-access-help-body em { font-style: italic; color: var(--ink, #1c1c1c); }
        .open-access-help-list {
          margin: 0 0 6px;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .open-access-help-list li::marker { color: var(--forest, #2d4a3a); }
        .open-access-help-footer {
          display: flex;
          justify-content: flex-end;
          padding: 14px 22px 18px;
        }
        .open-access-help-done-btn {
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--forest, #2d4a3a);
          color: var(--cream, #faf7f2);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          border: 0;
          cursor: pointer;
        }
        .open-access-help-done-btn:hover { background: #1f3528; }
      `}</style>
    </div>
  );
}
