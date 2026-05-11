"use client";

import { useState, useTransition } from "react";
import { Save, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/section";
import { updateSenderSettings } from "./actions";

interface SenderFormProps {
  initialEmail: string | null;
  initialName: string | null;
  verified: boolean;
  defaultFromAddress: string;
}

export function SenderForm({
  initialEmail,
  initialName,
  verified,
  defaultFromAddress,
}: SenderFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [name, setName] = useState(initialName ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateSenderSettings(fd);
      if (!r.ok) {
        setError(r.error ?? "Save failed");
      } else {
        setSaved(true);
      }
    });
  }

  const hasCustom = email.trim().length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Send-from name"
        htmlFor="sender_name"
        hint='Shown to the recipient. Usually your business name. e.g., "Dr. Huang Acupuncture".'
      >
        <Input
          id="sender_name"
          name="sender_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your business name"
        />
      </Field>

      <Field
        label="Send-from email"
        htmlFor="sender_email"
        hint="Use an address on your own domain so emails land in the Primary inbox instead of Promotions. Leave blank to use the shared BAAM Review address."
      >
        <Input
          id="sender_email"
          name="sender_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`reviews@yourdomain.com  (default: ${defaultFromAddress})`}
        />
      </Field>

      {hasCustom && (
        <VerificationBanner verified={verified} email={email} />
      )}

      {error && (
        <div
          role="alert"
          className="flex gap-2.5 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[13px] text-alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save"}
        </Button>
        {saved && !error && !pending && (
          <p className="text-[13px] text-success">Saved.</p>
        )}
      </div>
    </form>
  );
}

function VerificationBanner({
  verified,
  email,
}: {
  verified: boolean;
  email: string;
}) {
  const domain = email.split("@")[1] ?? "";

  if (verified) {
    return (
      <div className="flex gap-2.5 rounded-xl border border-success/30 bg-success/5 p-3 text-[13px]">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
        <p className="text-text">
          <strong>{domain}</strong> is verified. Emails will send from {email}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[13px]">
      <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-warn" />
      <div className="space-y-1.5 text-text">
        <p>
          <strong>{domain}</strong> needs verification before emails send from
          this address.
        </p>
        <p className="text-text-soft">
          We&apos;ll add your domain to Resend and send you the DNS records to
          add at your domain provider. Until then, your emails go from the
          shared BAAM Review address.{" "}
          <a
            href="mailto:support@baamplatform.com?subject=Sender%20verification"
            className="text-forest hover:underline"
          >
            Email support to start the process →
          </a>
        </p>
      </div>
    </div>
  );
}
