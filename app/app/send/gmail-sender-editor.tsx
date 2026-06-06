"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateLocationGmailSender } from "./actions";

interface GmailSenderEditorProps {
  locationId: string;
  /** Saved value from the DB. Used as the baseline for the "dirty" check. */
  initialEmail: string;
  /** OAuth-connected Google account, shown as a fallback display when no
   * explicit preset is set. Not editable here. */
  connectedViaGoogleEmail?: string | null;
  /** When this editor is wrapped in a FormRow (left-label layout), the
   * parent already renders the field label, so suppress the internal one. */
  hideLabel?: boolean;
  /** When true, the parent has flagged this field as a required-but-missing
   * blocker (e.g., the user clicked "Send in Gmail" with no sender set).
   * Flips the "No sender set yet" helper line to red + makes it explicit
   * that the field is required, matching the Customer name / Email address
   * field-error pattern. */
  requiredError?: boolean;
}

/**
 * Per-location Gmail sender preset, editable inline on the Send page.
 * Writes to `locations.gmail_sender_email` via updateLocationGmailSender;
 * Location Setup reads the same column, so the two pages stay in sync.
 *
 * Save is disabled until the input differs from the saved value — avoids
 * accidental overwrites without forcing an Edit-mode toggle for one field.
 * Test opens Gmail with this account pre-selected (no real send), same
 * pattern as the Location Setup field.
 */
export function GmailSenderEditor({
  locationId,
  initialEmail,
  connectedViaGoogleEmail,
  hideLabel = false,
  requiredError = false,
}: GmailSenderEditorProps) {
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [draft, setDraft] = useState(initialEmail);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reset when the parent switches locations.
  useEffect(() => {
    setSavedEmail(initialEmail);
    setDraft(initialEmail);
    setError(null);
    setSavedAt(null);
  }, [locationId, initialEmail]);

  // Auto-clear the "Saved ✓" indicator after a moment.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (savedAt == null) return;
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedAt(null), 2500);
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [savedAt]);

  const trimmed = draft.trim().toLowerCase();
  const isValid =
    trimmed.length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const dirty = trimmed !== savedEmail.trim().toLowerCase();
  const canSave = dirty && isValid && !pending;
  const canTest = trimmed.length > 0 && isValid;

  const effectiveDisplay =
    savedEmail.trim() || connectedViaGoogleEmail || "";

  function onSave() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      const res = await updateLocationGmailSender(locationId, draft);
      if (!res.ok) {
        setError(res.error ?? "Could not save");
        return;
      }
      setSavedEmail(res.saved ?? "");
      setDraft(res.saved ?? "");
      setSavedAt(Date.now());
    });
  }

  function onTest() {
    if (!canTest) return;
    const composeBase =
      "https://mail.google.com/mail/?view=cm&fs=1&tf=1" +
      `&to=${encodeURIComponent(trimmed)}` +
      `&su=${encodeURIComponent("BAAM sender account check")}` +
      `&body=${encodeURIComponent(
        "This is a quick test to confirm this Gmail account opens for BAAM preview sending.",
      )}` +
      `&authuser=${encodeURIComponent(trimmed)}`;
    const href =
      "https://accounts.google.com/AccountChooser" +
      `?Email=${encodeURIComponent(trimmed)}` +
      `&continue=${encodeURIComponent(composeBase)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <label
          htmlFor={`gmail_sender_${locationId}`}
          className="text-[12.5px] font-medium tracking-tight text-text-soft"
        >
          Sender Gmail{" "}
          <span className="font-normal text-text-muted">
            (used when staff clicks &ldquo;Send in Gmail&rdquo;)
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`gmail_sender_${locationId}`}
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          placeholder={connectedViaGoogleEmail || "name@gmail.com"}
          className="flex-1 min-w-[220px] shadow-none"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-[12.5px] font-medium text-cream hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : savedAt != null && !dirty ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={!canTest}
          className="inline-flex items-center rounded-md border border-border-base bg-paper px-3 py-1.5 text-[12.5px] text-text-soft hover:bg-cream-deep/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Test →
        </button>
      </div>

      {!isValid && (
        <p className="text-[12px] text-alert">
          Please enter a valid email address.
        </p>
      )}
      {error && (
        <p className="text-[12px] text-alert" role="alert">
          {error}
        </p>
      )}
      {!effectiveDisplay && !error && (
        <p
          className={`text-[12px] ${
            requiredError ? "text-alert font-medium" : "text-text-muted"
          }`}
          role={requiredError ? "alert" : undefined}
        >
          {requiredError ? "Sender Gmail is required. " : "No sender set yet. "}
          Or set it in{" "}
          <Link
            href={`/app/locations/${locationId}?tab=email`}
            className={
              requiredError
                ? "underline hover:no-underline"
                : "text-forest underline hover:no-underline"
            }
          >
            Location Setup
          </Link>
          .
        </p>
      )}
    </div>
  );
}
