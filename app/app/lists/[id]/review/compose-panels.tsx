"use client";

import { useMemo, useState } from "react";
import { buildSmsBody, type TemplateVars } from "@/lib/messaging/templates";
import type { Language } from "@/lib/i18n/review";
import { DefaultContentPanel } from "./default-content-panel";
import { VariantsPanel, type ListVariant } from "./variants-panel";

interface ComposePanelsProps {
  listId: string;
  language: Language;
  businessName: string;
  initialVariants: ListVariant[] | null;
  initialChannel: "email" | "sms";
  readOnly?: boolean;
}

export function ComposePanels({
  listId,
  language,
  businessName,
  initialVariants,
  initialChannel,
  readOnly = false,
}: ComposePanelsProps) {
  const [channel, setChannel] = useState<"email" | "sms">(initialChannel);
  const smsVars: TemplateVars = useMemo(
    () => ({
      name: "{name}",
      businessName,
      link: "https://baamreview.com/r/<slug>?t=<token>",
    }),
    [businessName],
  );
  const defaultSmsBody = useMemo(
    () => buildSmsBody(language, smsVars).body,
    [language, smsVars],
  );
  const [smsDraftBody, setSmsDraftBody] = useState(defaultSmsBody);

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border-base bg-cream p-0.5">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
              channel === "email"
                ? "bg-forest text-cream"
                : "text-text-soft hover:text-text"
            }`}
          >
            Email content
          </button>
          <button
            type="button"
            onClick={() => setChannel("sms")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
              channel === "sms"
                ? "bg-forest text-cream"
                : "text-text-soft hover:text-text"
            }`}
          >
            SMS content
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 mb-12">
        <DefaultContentPanel
          language={language}
          channel={channel}
          businessName={businessName}
          smsDraftBody={channel === "sms" ? smsDraftBody : undefined}
          onSmsDraftBodyChange={channel === "sms" ? setSmsDraftBody : undefined}
          onSmsDraftReset={
            channel === "sms" ? () => setSmsDraftBody(defaultSmsBody) : undefined
          }
        />
        <VariantsPanel
          listId={listId}
          initialVariants={initialVariants}
          channel={channel}
          smsBaseBody={channel === "sms" ? smsDraftBody : undefined}
          readOnly={readOnly}
        />
      </div>
    </>
  );
}
