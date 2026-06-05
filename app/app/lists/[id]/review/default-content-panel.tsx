import { Mail, MessageSquare } from "lucide-react";
import {
  buildEmail,
  buildSmsBody,
  type TemplateVars,
} from "@/lib/messaging/templates";
import type { Language } from "@/lib/i18n/review";

interface DefaultContentPanelProps {
  language: Language;
  channel: "email" | "sms";
  businessName: string;
}

/** Read-only preview of what BAAM Review sends when no AI variants exist
 *  (or for variant 0, which is always the default template as-is). Built
 *  from `lib/messaging/templates.ts` with sample vars so customers can
 *  see the exact copy before generating variations. */
export function DefaultContentPanel({
  language,
  channel,
  businessName,
}: DefaultContentPanelProps) {
  const vars: TemplateVars = {
    name: "{name}",
    businessName,
    link: "https://baamreview.com/r/<slug>?t=<token>",
  };

  const Icon = channel === "email" ? Mail : MessageSquare;

  return (
    <div className="rounded-2xl border border-border-base bg-paper px-6 py-5 h-full max-h-[480px] flex flex-col min-h-0">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="h-4 w-4 text-text-soft" />
        <div>
          <p className="text-[14px] font-medium text-ink">Default content</p>
          <p className="text-[12px] text-text-muted leading-snug">
            Sent as-is when no AI variations are generated.
          </p>
        </div>
      </div>

      {channel === "email" ? (
        <EmailPreview language={language} vars={vars} />
      ) : (
        <SmsPreview language={language} vars={vars} />
      )}

      <p className="text-[11.5px] text-text-muted italic mt-auto pt-3">
        <code className="font-mono">{"{name}"}</code> is replaced with each
        customer&apos;s first name.{" "}
        <code className="font-mono">&lt;slug&gt;</code> and{" "}
        <code className="font-mono">&lt;token&gt;</code> become their tracking
        URL.
      </p>
    </div>
  );
}

function EmailPreview({
  language,
  vars,
}: {
  language: Language;
  vars: TemplateVars;
}) {
  const { subject, body } = buildEmail(language, vars);
  return (
    <div className="rounded-xl border border-border-soft bg-cream/30 p-4 flex-1 min-h-0 overflow-y-auto">
      <p className="text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium mb-1">
        Subject
      </p>
      <p className="text-[13.5px] text-ink font-medium mb-3">{subject}</p>
      <p className="text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium mb-1">
        Body
      </p>
      <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-text">
        {body}
      </pre>
    </div>
  );
}

function SmsPreview({
  language,
  vars,
}: {
  language: Language;
  vars: TemplateVars;
}) {
  const { body } = buildSmsBody(language, vars);
  return (
    <div className="rounded-xl border border-border-soft bg-cream/30 p-4 flex-1 min-h-0 overflow-y-auto">
      <p className="text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium mb-1">
        SMS body
      </p>
      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-text">
        {body}
      </pre>
    </div>
  );
}
