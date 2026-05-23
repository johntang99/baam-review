import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "../booking-form";

export const metadata: Metadata = {
  title: "预约免费咨询 — BAAM Review",
  description:
    "告诉我们您的生意情况和方便的时段 —— 1 个工作日内我们会回复您,附上两个具体的时间供您选择。",
};

export default function BookZhPage() {
  return (
    <main className="min-h-screen bg-cream text-text">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <Link
          href="/zh"
          className="font-display text-[20px] font-medium tracking-tight text-ink"
        >
          BAAM Review
        </Link>
        <div className="flex items-center gap-4 text-[13px]">
          <Link href="/book" className="text-text-soft hover:text-ink">
            English
          </Link>
          <Link href="/pricing/zh" className="text-text-soft hover:text-ink">
            ← 价格
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[840px] px-6 pb-24 pt-6">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-gold-dark">
          免费 30 分钟咨询
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight text-ink">
          告诉我们您的生意情况。
        </h1>
        <p className="mt-3 font-serif text-[16px] italic leading-relaxed text-text-soft">
          没有推销话术。一次真正的对话 —— 关于评价、转介绍、回头客 ——
          看看 BAAM Review 是不是适合您。
        </p>

        <div className="mt-8 rounded-2xl border border-border-base bg-paper p-6 shadow-sm">
          <BookingForm lang="zh" source="book-zh" />
        </div>

        <p className="mt-5 text-center text-[12.5px] text-text-muted">
          想直接邮件联系?可发至{" "}
          <a
            href="mailto:support@baamplatform.com"
            className="text-forest hover:underline"
          >
            support@baamplatform.com
          </a>
          。
        </p>
      </div>
    </main>
  );
}
