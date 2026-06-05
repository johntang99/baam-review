"use client";

import { useEffect, useState } from "react";

interface FormState {
  name: string;
  email: string;
  subject: string;
  question: string;
}

const EMPTY: FormState = { name: "", email: "", subject: "", question: "" };

/** Modal triggered by any element with `data-ask-question` in the static
 *  marketing HTML. Posts to /api/contact/ask which mails the question to
 *  service@baamplatform.com and an auto-reply to the sender. */
export function AskQuestionModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest(
        "[data-ask-question]",
      );
      if (!target) return;
      e.preventDefault();
      setForm(EMPTY);
      setError(null);
      setSent(false);
      setOpen(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.question.trim()) {
      setError("Name, email, and question are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Couldn't send. Try again in a moment.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div
        className="aqm-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aqm-title"
        onClick={() => setOpen(false)}
      >
        <div className="aqm-card" onClick={(e) => e.stopPropagation()}>
          <div className="aqm-header">
            <h2 id="aqm-title" className="aqm-title">
              {sent ? "Thanks — we've got your question." : "Ask us a question"}
            </h2>
            <button
              type="button"
              className="aqm-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {sent ? (
            <div className="aqm-body">
              <p className="aqm-confirmation">
                A confirmation copy is on its way to{" "}
                <strong>{form.email}</strong>. We typically reply within one
                business day.
              </p>
              <div className="aqm-footer">
                <button
                  type="button"
                  className="aqm-btn aqm-btn-primary"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form className="aqm-body" onSubmit={submit}>
              <p className="aqm-deck">
                Send a note to our team — we&apos;ll reply by email.
              </p>

              <div className="aqm-grid">
                <Field
                  id="aqm-name"
                  label="Your name"
                  required
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  disabled={submitting}
                  autoComplete="name"
                />
                <Field
                  id="aqm-email"
                  type="email"
                  label="Email"
                  required
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  disabled={submitting}
                  autoComplete="email"
                />
              </div>

              <Field
                id="aqm-subject"
                label="Subject"
                value={form.subject}
                onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
                disabled={submitting}
                placeholder="e.g., Pricing for multi-location"
              />

              <label htmlFor="aqm-question" className="aqm-label">
                Your question <span className="aqm-required">·required</span>
              </label>
              <textarea
                id="aqm-question"
                className="aqm-textarea"
                rows={5}
                value={form.question}
                onChange={(e) =>
                  setForm((f) => ({ ...f, question: e.target.value }))
                }
                disabled={submitting}
                required
                placeholder="What would you like to know?"
              />

              {error && <p className="aqm-error">{error}</p>}

              <div className="aqm-footer">
                <button
                  type="button"
                  className="aqm-btn aqm-btn-ghost"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="aqm-btn aqm-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send question →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  required,
  type = "text",
  value,
  onChange,
  disabled,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="aqm-label">
        {label}
        {required && <span className="aqm-required"> ·required</span>}
      </label>
      <input
        id={id}
        type={type}
        className="aqm-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </div>
  );
}

const CSS = `
.aqm-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(28, 28, 28, 0.42);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: aqm-fade 160ms ease-out;
  font-family: 'Onest', sans-serif;
}
@keyframes aqm-fade { from { opacity: 0; } to { opacity: 1; } }
.aqm-card {
  width: 100%; max-width: 560px;
  background: #FAF7F2;
  border-radius: 16px;
  box-shadow: 0 30px 60px -20px rgba(28, 28, 28, 0.35);
  overflow: hidden;
  animation: aqm-pop 180ms ease-out;
}
@keyframes aqm-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.aqm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(28, 28, 28, 0.08);
}
.aqm-title {
  margin: 0;
  font-family: 'Fraunces', serif;
  font-size: 22px; font-weight: 500;
  color: #1c1c1c; letter-spacing: -0.01em;
}
.aqm-close {
  background: none; border: 0;
  font-size: 26px; line-height: 1;
  color: #888; cursor: pointer;
  padding: 4px 8px;
}
.aqm-close:hover { color: #1c1c1c; }
.aqm-body { padding: 20px 24px 22px; display: flex; flex-direction: column; gap: 12px; }
.aqm-deck { margin: 0 0 6px; font-size: 13.5px; color: #555; line-height: 1.5; }
.aqm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 480px) { .aqm-grid { grid-template-columns: 1fr; } }
.aqm-label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #555;
  margin-bottom: 6px;
}
.aqm-required {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.02em;
  color: #888;
}
.aqm-input, .aqm-textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid rgba(28, 28, 28, 0.14);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  font-family: inherit;
  color: #1c1c1c;
  box-sizing: border-box;
}
.aqm-input:focus, .aqm-textarea:focus {
  outline: none;
  border-color: #2D4A3A;
  box-shadow: 0 0 0 3px rgba(45, 74, 58, 0.18);
}
.aqm-textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
.aqm-error {
  margin: 0;
  font-size: 13px;
  color: #A4452A;
  padding: 8px 12px;
  background: rgba(164, 69, 42, 0.08);
  border-radius: 6px;
}
.aqm-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  margin-top: 6px;
}
.aqm-btn {
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 120ms, transform 80ms;
}
.aqm-btn:active { transform: translateY(1px); }
.aqm-btn:disabled { opacity: 0.6; cursor: default; }
.aqm-btn-primary { background: #2D4A3A; color: #FAF7F2; }
.aqm-btn-primary:hover:not(:disabled) { background: #1F3528; }
.aqm-btn-ghost { background: transparent; color: #555; border-color: rgba(28, 28, 28, 0.16); }
.aqm-btn-ghost:hover:not(:disabled) { background: rgba(28, 28, 28, 0.04); }
.aqm-confirmation { margin: 4px 0 0; font-size: 14px; color: #2a2a2a; line-height: 1.6; }
`;
