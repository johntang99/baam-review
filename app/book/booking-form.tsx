"use client";

import { useState, useTransition } from "react";
import { submitBookingRequest } from "./actions";

export type BookingLang = "en" | "zh";

interface BookingStrings {
  // labels
  name: string;
  email: string;
  phone: string;
  phone_hint: string;
  website: string;
  address: string;
  address_hint: string;
  preferred_time: string;
  morning: string;
  morning_window: string;
  afternoon: string;
  afternoon_window: string;
  preferred_time_help: string;
  notes: string;
  notes_placeholder: string;
  // CTA + states
  cta: string;
  cta_sending: string;
  footer: string;
  // success
  thanks_title: string;
  thanks_body: string;
}

const STRINGS: Record<BookingLang, BookingStrings> = {
  en: {
    name: "Your name",
    email: "Email",
    phone: "Phone",
    phone_hint: "Optional — for SMS confirmation only.",
    website: "Website",
    address: "Business address",
    address_hint: "So we can pull your Google Business Profile before the call.",
    preferred_time: "Preferred meeting time",
    morning: "Morning",
    morning_window: "9 am – 12 pm ET",
    afternoon: "Afternoon",
    afternoon_window: "1 – 5 pm ET",
    preferred_time_help: "We'll reply with 2 specific time slots based on your preference.",
    notes: "Anything to know?",
    notes_placeholder:
      "Industry, biggest review problem, languages you serve…",
    cta: "Request my consultation",
    cta_sending: "Sending…",
    footer:
      "We reply within 1 business day with 2 time slots. No spam, no automated sales calls.",
    thanks_title: "Thanks — we'll be in touch.",
    thanks_body:
      "We'll email you within 1 business day with two time slots that match your preference. Check your inbox (and spam folder, just in case).",
  },
  zh: {
    name: "您的姓名",
    email: "电子邮箱",
    phone: "电话",
    phone_hint: "可选 — 仅用于短信确认。",
    website: "网站",
    address: "店铺地址",
    address_hint: "方便我们在通话前先看您的 Google 商家资料。",
    preferred_time: "方便沟通时段",
    morning: "上午",
    morning_window: "9 点 – 12 点(美东时间)",
    afternoon: "下午",
    afternoon_window: "1 – 5 点(美东时间)",
    preferred_time_help: "我们会根据您的偏好,回复两个具体时间供您挑选。",
    notes: "想让我们提前知道的事",
    notes_placeholder: "行业、最头疼的评价问题、服务的语言…",
    cta: "提交咨询请求",
    cta_sending: "发送中…",
    footer:
      "1 个工作日内回复,附两个时间供您选择。不发垃圾邮件,也没有自动推销电话。",
    thanks_title: "已收到 — 我们会主动联系您。",
    thanks_body:
      "1 个工作日内,我们会把两个符合您偏好的时间发到您的邮箱(也请留意垃圾邮件夹)。",
  },
};

export function BookingForm({
  source = "book",
  lang = "en",
}: {
  source?: string;
  lang?: BookingLang;
}) {
  const s = STRINGS[lang];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-display text-[19px] text-ink">{s.thanks_title}</p>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-text-soft">
          {s.thanks_body}
        </p>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitBookingRequest(fd);
      if (res.ok) setDone(true);
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[14px] text-text focus:border-forest focus:bg-paper focus:outline-none";
  const labelCls =
    "block text-[12px] font-medium text-text mb-1.5 tracking-[0.01em]";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="language" value={lang} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="bk-name" className={labelCls}>
            {s.name}
          </label>
          <input id="bk-name" name="name" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="bk-email" className={labelCls}>
            {s.email}
          </label>
          <input
            id="bk-email"
            name="email"
            type="email"
            required
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="bk-phone" className={labelCls}>
            {s.phone}
          </label>
          <input
            id="bk-phone"
            name="phone"
            type="tel"
            className={inputCls}
            placeholder="(555) 555-1234"
          />
          <p className="mt-1 text-[11px] text-text-muted">{s.phone_hint}</p>
        </div>
        <div>
          <label htmlFor="bk-website" className={labelCls}>
            {s.website}
          </label>
          <input
            id="bk-website"
            name="website"
            type="url"
            className={inputCls}
            placeholder="https://"
          />
        </div>
      </div>

      <div>
        <label htmlFor="bk-address" className={labelCls}>
          {s.address}
        </label>
        <input id="bk-address" name="address" className={inputCls} />
        <p className="mt-1 text-[11px] text-text-muted">{s.address_hint}</p>
      </div>

      <fieldset>
        <legend className={labelCls}>{s.preferred_time}</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[13.5px] has-[:checked]:border-forest has-[:checked]:bg-forest/[0.04]">
            <input
              type="radio"
              name="preferred_time"
              value="morning"
              defaultChecked
              className="h-4 w-4"
            />
            <span className="font-medium text-ink">{s.morning}</span>
            <span className="text-text-muted">({s.morning_window})</span>
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[13.5px] has-[:checked]:border-forest has-[:checked]:bg-forest/[0.04]">
            <input
              type="radio"
              name="preferred_time"
              value="afternoon"
              className="h-4 w-4"
            />
            <span className="font-medium text-ink">{s.afternoon}</span>
            <span className="text-text-muted">({s.afternoon_window})</span>
          </label>
        </div>
        <p className="mt-1.5 text-[11px] text-text-muted">
          {s.preferred_time_help}
        </p>
      </fieldset>

      <div>
        <label htmlFor="bk-notes" className={labelCls}>
          {s.notes}
        </label>
        <textarea
          id="bk-notes"
          name="notes"
          rows={3}
          placeholder={s.notes_placeholder}
          className={`${inputCls} resize-y`}
        />
      </div>

      {error && (
        <p className="text-[13px] text-alert" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-forest px-5 py-3 text-[14.5px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
      >
        {pending ? s.cta_sending : s.cta}
      </button>
      <p className="text-center text-[11.5px] text-text-muted">{s.footer}</p>
    </form>
  );
}
