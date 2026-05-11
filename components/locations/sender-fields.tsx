"use client";

import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/section";

interface SenderFieldsProps {
  initialEmail: string | null;
  initialName: string | null;
  verified: boolean;
  defaultFromAddress: string;
}

export function SenderFields({
  initialEmail,
  initialName,
  verified,
  defaultFromAddress,
}: SenderFieldsProps) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [name, setName] = useState(initialName ?? "");

  const hasCustom = email.trim().length > 0;

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
