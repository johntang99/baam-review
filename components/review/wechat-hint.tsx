"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";
import { STRINGS, type Language } from "@/lib/i18n/review";
import { track, type TrackContext } from "./track";

interface WeChatHintProps {
  ctx: TrackContext;
  lang: Language;
}

export function WeChatHint({ ctx, lang }: WeChatHintProps) {
  const s = STRINGS[lang];

  useEffect(() => {
    track(ctx, "language_selected", {
      reason: "wechat_browser_detected",
      language: lang,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="alert"
      className="rounded-xl border border-warn/30 bg-warn/5 p-4 text-[13.5px] text-text"
    >
      <div className="flex gap-2.5">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-warn" />
        <div className="space-y-1">
          <p className="font-medium">{s.wechat_title}</p>
          <p className="text-text-soft leading-relaxed">{s.wechat_body}</p>
        </div>
      </div>
    </div>
  );
}
