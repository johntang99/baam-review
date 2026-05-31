"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Send,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import {
  asEmailOrEmpty,
  buildGmailComposeHref,
} from "@/lib/messaging/gmail-compose";
import { buildSmsBody, buildEmail } from "@/lib/messaging/templates";
import type { Language } from "@/lib/i18n/review";
import {
  sendReviewRequest,
  createGmailDraftRequest,
  type SendResult,
} from "./actions";

interface LocationOption {
  id: string;
  slug: string;
  display_name: string;
  default_language: string;
  supported_languages: string[];
  gmail_sender_email?: string | null;
  connected_via_google_email?: string | null;
}

interface SendFormProps {
  locations: LocationOption[];
  smsEnabled: boolean;
  initialLocationId?: string | null;
  blockedLocationIds: string[];
}

const ALL_LANGS = ["en", "zh", "es"] as const;
const LANG_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

function isLang(s: string): s is Language {
  return (ALL_LANGS as readonly string[]).includes(s);
}

export function SendForm({
  locations,
  smsEnabled,
  initialLocationId,
  blockedLocationIds,
}: SendFormProps) {
  const initialLocation =
    locations.find((l) => l.id === initialLocationId) ?? locations[0];
  const [locationId, setLocationId] = useState<string>(initialLocation?.id ?? "");
  // Email is the default channel. SMS only becomes preferred once Twilio
  // is wired up AND the user explicitly picks it.
  const [channel, setChannel] = useState<"sms" | "email">("email");
  // Brief "Coming soon" hint shown when user clicks the disabled SMS toggle.
  const [smsHintShown, setSmsHintShown] = useState(false);
  const [language, setLanguage] = useState<string>(
    initialLocation?.default_language ?? "en",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);
  const [openingGmail, startOpenGmailTransition] = useTransition();
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  const currentLocation = locations.find((l) => l.id === locationId);
  const currentGmailSender = asEmailOrEmpty(
    currentLocation?.gmail_sender_email ||
      currentLocation?.connected_via_google_email ||
      "",
  );
  const billingBlocked = blockedLocationIds.includes(locationId);
  const supported = currentLocation?.supported_languages ?? ["en"];
  const missingLangs = ALL_LANGS.filter((l) => !supported.includes(l));

  const previewName = name.trim() || (
    language === "zh" ? "客户" : language === "es" ? "Cliente" : "Customer"
  );
  // Use the public env so server and client render identically — referring
  // window inside render would mismatch on hydration.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";
  const previewLink = `${appUrl}/r/<slug>?t=<token>`;
  const previewVars = {
    name: previewName,
    businessName: currentLocation?.display_name ?? "",
    link: previewLink,
  };
  const previewLang: Language = isLang(language) ? language : "en";

  // Editable preview state. The defaults regenerate when the upstream
  // template inputs change (language, channel, name, location) UNLESS the
  // user has manually touched the field, in which case we preserve their edit.
  const [subject, setSubject] = useState<string>(() =>
    buildEmail(previewLang, previewVars).subject,
  );
  const [body, setBody] = useState<string>(() =>
    channel === "sms"
      ? buildSmsBody(previewLang, previewVars).body
      : buildEmail(previewLang, previewVars).body,
  );
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);

  // AI rewrite state — history stack so the user can undo back through
  // previous drafts after multiple regenerations. For email each history
  // entry tracks subject+body together (since rewrites change both).
  type Tone = "warm" | "brief" | "professional" | "casual";
  type RewriteSnapshot = { subject: string; body: string };
  const [tone, setTone] = useState<Tone>("warm");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteHistory, setRewriteHistory] = useState<RewriteSnapshot[]>([]);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  async function rewriteBodyWithAI() {
    if (!currentLocation || rewriting) return;
    setRewriteError(null);
    setRewriting(true);
    try {
      const res = await fetch("/api/send/rewrite-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentBody: body,
          currentSubject: channel === "email" ? subject : undefined,
          businessName: currentLocation.display_name,
          language: previewLang,
          tone,
          channel,
          // Pass the name from the form so the API can expand {name} → first
          // name before returning. Without this the preview would show
          // "Hi {name}," literally, which is confusing for staff.
          recipientName: previewName,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        body?: string;
        subject?: string;
        error?: string;
      };
      if (!json.ok || !json.body) {
        setRewriteError(json.error ?? "Rewrite failed");
        return;
      }
      setRewriteHistory((h) => [...h, { subject, body }]);
      setBody(json.body);
      setBodyTouched(true);
      if (channel === "email" && json.subject) {
        setSubject(json.subject);
        setSubjectTouched(true);
      }
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRewriting(false);
    }
  }

  function undoRewrite() {
    if (rewriteHistory.length === 0) return;
    const previous = rewriteHistory[rewriteHistory.length - 1];
    setRewriteHistory((h) => h.slice(0, -1));
    setBody(previous.body);
    if (channel === "email") setSubject(previous.subject);
    setRewriteError(null);
  }

  useEffect(() => {
    const fresh =
      channel === "sms"
        ? { subject: "", body: buildSmsBody(previewLang, previewVars).body }
        : (() => {
            const e = buildEmail(previewLang, previewVars);
            return { subject: e.subject, body: e.body };
          })();
    // This preview editor intentionally "re-seeds" untouched fields when
    // template inputs change (language/channel/location/name).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!subjectTouched) setSubject(fresh.subject);
    if (!bodyTouched) setBody(fresh.body);
    // intentionally narrow deps — recompute on the inputs that drive the template
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewLang, channel, previewName, currentLocation?.display_name]);

  function resetPreview() {
    setSubjectTouched(false);
    setBodyTouched(false);
    if (channel === "sms") {
      setSubject("");
      setBody(buildSmsBody(previewLang, previewVars).body);
    } else {
      const e = buildEmail(previewLang, previewVars);
      setSubject(e.subject);
      setBody(e.body);
    }
  }

  function onLocationChange(id: string) {
    setLocationId(id);
    const loc = locations.find((l) => l.id === id);
    if (loc) setLanguage(loc.default_language);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setGmailError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await sendReviewRequest(fd);
      setResult(r);
      if (r.ok) {
        setName("");
        setPhone("");
        setEmail("");
      }
    });
  }

  function validateEmailRequiredFields(): boolean {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = "Customer name is required.";
    if (channel === "email") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        next.email = "Email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        next.email = "Enter a valid email address.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function openGmailDirectly() {
    setResult(null);
    setGmailError(null);

    if (channel !== "email") {
      setGmailError("Switch to Email to open Gmail.");
      return;
    }
    if (!currentLocation) return;
    if (!validateEmailRequiredFields()) return;

    // Open immediately on user gesture so popup isn't blocked later.
    // Don't use noopener here: we need a live Window handle to navigate
    // this exact tab after async draft preparation finishes.
    const popup = window.open("", "_blank");
    startOpenGmailTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("location_id", currentLocation.id);
        fd.set("recipient_name", name.trim());
        fd.set("recipient_email", email.trim());
        fd.set("language", language);
        fd.set("message_subject", subject);
        fd.set("message_body", body);

        const draft = await createGmailDraftRequest(fd);
        if (!draft.ok || !draft.subject || !draft.body || !draft.trackingUrl) {
          setGmailError(
            draft.error || "Could not prepare Gmail draft. Please try again.",
          );
          popup?.close();
          return;
        }

        const href = buildGmailComposeHref({
          to: email.trim(),
          subject: draft.subject,
          body: draft.body,
          senderGmail: currentGmailSender,
        });

        if (popup && !popup.closed) {
          popup.location.assign(href);
          popup.focus();
        } else {
          // Fallback if popup handle was lost by browser policy.
          window.open(href, "_blank");
        }
      } catch (error) {
        setGmailError(
          error instanceof Error
            ? error.message
            : "Could not open Gmail right now.",
        );
        popup?.close();
      }
    });
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-8 text-center max-w-2xl">
        <h2 className="font-display text-[20px] text-ink">No locations yet</h2>
        <p className="mt-1.5 text-[14px] text-text-soft leading-relaxed">
          Connect a Google Business Profile first.
        </p>
        <Link
          href="/app/locations"
          className="mt-4 inline-block text-[13px] font-medium text-forest hover:underline"
        >
          Go to Locations →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12.5px] text-text">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-warn" />
        <p>
          Only send to people who actually visited{" "}
          <span className="font-medium">{currentLocation?.display_name ?? "your business"}</span>.
          Sharing the link with friends who didn&apos;t visit is a Google policy
          violation and can get your reviews removed or your profile suspended.
        </p>
      </div>

      {billingBlocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3.5">
          <p className="text-[13px] text-ink">
            <span className="font-medium">Billing required</span> — set up
            billing for{" "}
            <span className="font-medium">
              {currentLocation?.display_name ?? "this location"}
            </span>{" "}
            before sending review requests.
          </p>
          <Link
            href="/app/billing"
            className="shrink-0 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-white hover:bg-forest-dark"
          >
            Set up billing →
          </Link>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border-base bg-paper p-5 sm:p-6 shadow-sm">
        {locations.length > 1 && (
          <Field label="Location" htmlFor="location_id">
            <div className="space-y-2">
              <select
                id="location_id"
                name="location_id"
                value={locationId}
                onChange={(e) => onLocationChange(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border-base bg-paper px-3 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.display_name}
                  </option>
                ))}
              </select>
              <SenderBadge
                sender={currentGmailSender}
                locationId={currentLocation?.id || ""}
              />
            </div>
          </Field>
        )}
        {locations.length === 1 && (
          <>
            <input type="hidden" name="location_id" value={locationId} />
            <div className="rounded-lg border border-border-soft bg-cream/30 px-3 py-2">
              <p className="text-[12px] text-text-soft">
                Location:{" "}
                <span className="font-medium text-ink">
                  {currentLocation?.display_name ?? "Current location"}
                </span>
              </p>
              <div className="mt-1.5">
                <SenderBadge
                  sender={currentGmailSender}
                  locationId={currentLocation?.id || ""}
                />
              </div>
            </div>
          </>
        )}

        <Field label="Customer name" htmlFor="recipient_name">
          <Input
            id="recipient_name"
            name="recipient_name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            className={
              fieldErrors.name
                ? "border-alert focus:border-alert focus:ring-alert/20"
                : ""
            }
          />
          {fieldErrors.name && (
            <p className="text-[12px] text-alert">{fieldErrors.name}</p>
          )}
        </Field>

        <div className="space-y-2">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            How to send
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ChannelToggle
              icon={Mail}
              label="Email"
              active={channel === "email"}
              onClick={() => setChannel("email")}
            />
            <ChannelToggle
              icon={MessageSquare}
              label="SMS"
              active={channel === "sms"}
              disabled={!smsEnabled}
              hint={!smsEnabled ? "Coming soon" : undefined}
              onClick={() => {
                if (!smsEnabled) {
                  // Show the inline hint; persists until the user
                  // clicks the toggle again (toggle to dismiss).
                  setSmsHintShown((shown) => !shown);
                  return;
                }
                setChannel("sms");
              }}
            />
          </div>
          {smsHintShown && (
            <div
              role="status"
              className="rounded-lg border border-gold/40 bg-gold/[0.07] px-3.5 py-3 space-y-1.5"
            >
              <p className="text-[12.5px] font-semibold text-gold-dark">
                SMS delivery is coming soon
              </p>
              <p className="text-[12px] text-text-soft leading-relaxed">
                We&apos;re finishing the Twilio integration — verified
                sender numbers, A2P 10DLC registration for US carriers,
                and STOP / opt-out handling. Once it&apos;s live SMS will
                light up automatically for every location.
              </p>
              <p className="text-[12px] text-text-soft leading-relaxed">
                <strong className="text-ink">In the meantime, use Email.</strong>{" "}
                It has higher open rates for review requests in our data
                (typically 45–60% vs 25–35% for SMS) and no per-message
                cost.
              </p>
              <p className="text-[11.5px] text-text-muted">
                Need SMS sooner? Reply to{" "}
                <a
                  href="mailto:support@baamplatform.com"
                  className="text-forest hover:underline"
                >
                  support@baamplatform.com
                </a>{" "}
                and we&apos;ll prioritize.
              </p>
            </div>
          )}
          <input type="hidden" name="channel" value={channel} />
        </div>

        {channel === "sms" ? (
          <Field label="Phone number" htmlFor="recipient_phone" hint="Include country code, e.g. +12125551234">
            <Input
              id="recipient_phone"
              name="recipient_phone"
              type="tel"
              autoComplete="tel"
              required={channel === "sms"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1"
            />
          </Field>
        ) : (
          <Field label="Email address" htmlFor="recipient_email">
            <Input
              id="recipient_email"
              name="recipient_email"
              type="email"
              autoComplete="email"
              required={channel === "email"}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              className={
                fieldErrors.email
                  ? "border-alert focus:border-alert focus:ring-alert/20"
                  : ""
              }
            />
            {fieldErrors.email && (
              <p className="text-[12px] text-alert">{fieldErrors.email}</p>
            )}
          </Field>
        )}

        <div className="space-y-2">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Message language
          </p>
          <input type="hidden" name="language" value={language} />
          <div className="flex flex-wrap gap-2">
            {supported.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  language === code
                    ? "border-forest bg-forest text-cream"
                    : "border-border-base bg-paper text-text-soft hover:bg-hover",
                )}
              >
                {LANG_LABEL[code] ?? code.toUpperCase()}
              </button>
            ))}
          </div>
          {missingLangs.length > 0 && currentLocation && (
            <p className="text-[11.5px] text-text-muted pt-1">
              To send in {missingLangs.map((l) => LANG_LABEL[l]).join(" / ")},{" "}
              <Link
                href={`/app/locations/${currentLocation.id}`}
                className="text-forest hover:underline"
              >
                enable those languages on this location
              </Link>
              .
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border-soft bg-cream/40 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
              Message (editable)
            </p>
            {(subjectTouched || bodyTouched) && (
              <button
                type="button"
                onClick={resetPreview}
                className="text-[11.5px] text-text-soft hover:text-text underline"
              >
                Reset to default
              </button>
            )}
          </div>

          {channel === "email" && (
            <div className="space-y-1.5">
              <label
                htmlFor="message_subject"
                className="block text-[11.5px] font-medium tracking-tight text-text-soft"
              >
                Subject
              </label>
              <Input
                id="message_subject"
                name="message_subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSubjectTouched(true);
                }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="message_body"
                className="block text-[11.5px] font-medium tracking-tight text-text-soft"
              >
                {channel === "sms" ? "Text message" : "Body"}
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  disabled={rewriting}
                  className="rounded-md border border-border-base bg-paper px-2 py-1 text-[11.5px] text-text focus:outline-none focus:ring-2 focus:ring-forest/30 disabled:opacity-50"
                  aria-label="Rewrite tone"
                >
                  {previewLang === "zh" ? (
                    <>
                      <option value="warm">親切</option>
                      <option value="brief">簡潔</option>
                      <option value="professional">正式</option>
                      <option value="casual">輕鬆</option>
                    </>
                  ) : (
                    <>
                      <option value="warm">Warm</option>
                      <option value="brief">Brief</option>
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                    </>
                  )}
                </select>
                {rewriteHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={undoRewrite}
                    disabled={rewriting}
                    title="Undo last AI rewrite"
                    className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-2 py-1 text-[11.5px] text-text-soft hover:bg-cream-deep/30 disabled:opacity-50"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={rewriteBodyWithAI}
                  disabled={rewriting || !currentLocation}
                  className="inline-flex items-center gap-1 rounded-md border border-forest/30 bg-forest/10 px-2 py-1 text-[11.5px] font-medium text-forest hover:bg-forest/15 disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  {rewriting ? "Rewriting…" : "Rewrite with AI"}
                </button>
              </div>
            </div>
            {rewriteError && (
              <p className="text-[11px] text-alert">{rewriteError}</p>
            )}
            <Textarea
              id="message_body"
              name="message_body"
              rows={channel === "sms" ? 5 : 10}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setBodyTouched(true);
              }}
              className="text-[13px] leading-relaxed"
            />
            {channel === "sms" && (
              <p className="text-[11px] text-text-muted">
                {body.length} characters · {Math.max(1, Math.ceil(body.length / 160))} SMS segment{Math.max(1, Math.ceil(body.length / 160)) === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <p className="text-[11px] text-text-muted">
            Variables in <code className="font-mono">&lt;slug&gt;</code> /{" "}
            <code className="font-mono">&lt;token&gt;</code> are filled in when the
            message is sent. Other text sends exactly as written.
          </p>
        </div>

        {result && !result.ok && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[13px] text-alert"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{result.error}</p>
          </div>
        )}

        <div className="border-t border-border-base pt-5 space-y-3">
          <p className="text-[12.5px] text-text-soft leading-relaxed">
            <span className="font-medium text-ink">Tip:</span> Want it to feel
            personal? Click{" "}
            <span className="font-medium text-ink">
              Send in Gmail
            </span>{" "}
            to open a prefilled draft in Gmail web — recipient still lands on
            your review page.
          </p>
          <p className="text-[12px] text-text-soft">
            Sender Gmail preset for this location:{" "}
            <span className="font-medium text-ink">
              {currentGmailSender || "(not set — uses currently signed-in Gmail)"}
            </span>
            . You can update it in Location Settings → Email Sender.
          </p>
          {!currentGmailSender && currentLocation && (
            <p className="text-[12px] text-alert">
              Sender not set for this location.{" "}
              <Link
                href={`/app/locations/${currentLocation.id}?tab=email`}
                className="font-medium underline hover:no-underline"
              >
                Set Gmail sender preset →
              </Link>
            </p>
          )}
          {gmailError && (
            <p className="text-[12px] text-alert text-right">{gmailError}</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              size="lg"
              onClick={openGmailDirectly}
              disabled={
                !currentLocation ||
                billingBlocked ||
                openingGmail ||
                channel !== "email"
              }
            >
              <Mail className="h-4 w-4" />
              {openingGmail ? "Opening Gmail…" : "Send in Gmail"}
            </Button>
            <Button
              type="submit"
              size="lg"
              variant={channel === "email" ? "secondary" : "primary"}
              disabled={pending || billingBlocked}
              onClick={(e) => {
                if (!validateEmailRequiredFields()) {
                  e.preventDefault();
                }
              }}
            >
              <Send className="h-4 w-4" />
              {pending
                ? "Sending…"
                : `Send via ${channel === "sms" ? "SMS" : "BAAM email"}`}
            </Button>
          </div>
        </div>
      </form>

      {result?.ok && result.trackingUrl && (
        <SuccessCard
          trackingUrl={result.trackingUrl}
          flagged={!!result.flagged}
        />
      )}
    </div>
  );
}

function ChannelToggle({
  icon: Icon,
  label,
  active,
  disabled,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // Always fire onClick — the handler decides whether to switch
      // channel or show the "Coming soon" hint. Don't set the native
      // disabled attribute, or the click event never reaches us.
      onClick={onClick}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13.5px] transition-colors",
        active
          ? "border-forest bg-forest/5 text-ink"
          : "border-border-base bg-paper text-text-soft hover:bg-hover",
        disabled && "opacity-50 cursor-not-allowed hover:bg-paper",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      {hint && <span className="text-[11px] text-text-muted ml-auto">{hint}</span>}
    </button>
  );
}

function SenderBadge({
  sender,
  locationId,
}: {
  sender: string;
  locationId: string;
}) {
  const hasSender = Boolean(sender);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
          hasSender
            ? "border-success/35 bg-success/10 text-success"
            : "border-alert/35 bg-alert/10 text-alert",
        )}
      >
        Sender: {hasSender ? sender : "Not set"}
      </span>
      {!hasSender && locationId && (
        <Link
          href={`/app/locations/${locationId}?tab=email`}
          className="text-[11.5px] text-alert underline hover:no-underline"
        >
          Set now →
        </Link>
      )}
    </div>
  );
}

function SuccessCard({
  trackingUrl,
  flagged,
}: {
  trackingUrl: string;
  flagged: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-5 space-y-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-success" />
        <div className="space-y-1">
          <p className="font-display text-[16px] text-ink">Request sent.</p>
          <p className="text-[13px] text-text-soft">
            Your customer will get the message in a moment. You can also share the link directly.
          </p>
        </div>
      </div>

      {flagged && (
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-2.5 text-[12px] text-text">
          <p>
            <strong>Heads up:</strong> this send exceeded the recommended velocity
            for your location. It went through, but we&apos;ve flagged it for review.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-paper border border-border-base px-2.5 py-2 text-[12px] font-mono text-text truncate">
          {trackingUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="text-[12.5px] font-medium text-forest hover:underline whitespace-nowrap"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest hover:underline"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
