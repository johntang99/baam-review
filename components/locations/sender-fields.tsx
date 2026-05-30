"use client";

import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/section";

interface SenderFieldsProps {
  initialEmail: string | null;
  initialGmailSenderEmail: string | null;
  connectedViaGoogleEmail: string | null;
  initialName: string | null;
  verified: boolean;
  defaultFromAddress: string;
}

export function SenderFields({
  initialEmail,
  initialGmailSenderEmail,
  connectedViaGoogleEmail,
  initialName,
  verified,
  defaultFromAddress,
}: SenderFieldsProps) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [gmailSenderEmail, setGmailSenderEmail] = useState(
    initialGmailSenderEmail ?? "",
  );
  const [name, setName] = useState(initialName ?? "");

  const hasCustom = email.trim().length > 0;
  const effectiveGmailPreset =
    gmailSenderEmail.trim() || connectedViaGoogleEmail || "";
  const hasGmailInput = gmailSenderEmail.trim().length > 0;
  const gmailLooksValid =
    !hasGmailInput ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailSenderEmail.trim().toLowerCase());

  function openGmailPresetTest() {
    const trimmed = gmailSenderEmail.trim().toLowerCase();
    if (!trimmed || !gmailLooksValid) return;
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
    <>
      <Field
        label="Send-from name"
        htmlFor="sender_name"
        hint='Shown to the recipient. Usually the business name. e.g., "Dr. Huang Acupuncture".'
      >
        <Input
          id="sender_name"
          name="sender_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Defaults to this location's display name"
        />
      </Field>

      <Field
        label="Send-from email"
        htmlFor="sender_email"
        hint="Use an address on the business's own domain so emails land in Primary instead of Promotions. Leave blank to use the shared BAAM Review address."
      >
        <Input
          id="sender_email"
          name="sender_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`reviews@yourdomain.com  ·  default: ${defaultFromAddress}`}
        />
      </Field>

      <Field
        label="Gmail sender preset (Preview flow)"
        htmlFor="gmail_sender_email"
        hint='Used only for "Preview & Open in Gmail" on /app/send. Set the Gmail account that staff should send from for this location.'
      >
        <div className="space-y-2">
          <Input
            id="gmail_sender_email"
            name="gmail_sender_email"
            type="email"
            value={gmailSenderEmail}
            onChange={(e) => setGmailSenderEmail(e.target.value)}
            placeholder="drhuangclinic@gmail.com"
          />
          {!gmailLooksValid && (
            <p className="text-[12px] text-alert">
              Please enter a valid email format (example: name@gmail.com or
              name@company.com).
            </p>
          )}
          <button
            type="button"
            onClick={openGmailPresetTest}
            disabled={!hasGmailInput || !gmailLooksValid}
            className="inline-flex items-center rounded-md border border-border-base bg-paper px-2.5 py-1.5 text-[12px] text-text-soft hover:bg-cream-deep/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Test open this Gmail account →
          </button>
        </div>
      </Field>

      <div className="rounded-xl border border-border-base bg-cream-deep/30 px-3.5 py-3 text-[12.5px] text-text">
        <p>
          <strong className="text-ink">How it works:</strong> when staff clicks{" "}
          <span className="font-medium text-ink">Preview &amp; Open in Gmail</span>,
          BAAM opens Gmail compose with this account as the target sender.
        </p>
        <p className="mt-1 text-text-soft">
          The browser still requires login access to that Gmail account on this
          device.
          {effectiveGmailPreset
            ? ` Current preset: ${effectiveGmailPreset}.`
            : " No preset set yet."}
        </p>
      </div>

      {hasCustom &&
        (verified ? (
          <div className="flex gap-2.5 rounded-xl border border-success/30 bg-success/5 p-3 text-[13px]">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
            <p className="text-text">
              <strong>{email.split("@")[1]}</strong> is verified. Emails for this
              location will send from {email}.
            </p>
          </div>
        ) : (
          <div className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[13px]">
            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-warn" />
            <div className="space-y-1.5 text-text">
              <p>
                <strong>{email.split("@")[1] || "this domain"}</strong> needs
                verification before emails send from this address.
              </p>
              <p className="text-text-soft">
                We&apos;ll add the domain to Resend and send you DNS records
                to add at your domain provider. Until then, emails for this
                location go from the shared BAAM Review address.{" "}
                <a
                  href="mailto:support@baamplatform.com?subject=Sender%20verification"
                  className="text-forest hover:underline"
                >
                  Email support to start →
                </a>
              </p>
            </div>
          </div>
        ))}
    </>
  );
}
