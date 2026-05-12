"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "Will the AI-generated drafts get flagged by Google?",
    a: "No. The drafts are generated from your customer's specific inputs — what they were treated for, how it went, what they thought of you. The customer reviews and edits before posting, and they are the author of record. We disclose this clearly on the page. This is fundamentally different from fabricated reviews.",
  },
  {
    q: "What's the actual difference between Starter and Growth?",
    a: "Starter ($49) gets you stages 1–2 of the Review-to-Revenue Loop: collecting Google reviews with the AI-assisted flow, plus the embedded “Leave a Review” button and basic analytics. Growth ($99) adds stages 3–6: the website Display Widget that puts those reviews to work as conversion-driving social proof with schema markup, the AI Reply Assistant for responding to incoming reviews in multiple languages, automatic social graphics for Xiaohongshu/Instagram/Facebook, share-with-a-friend referral links, the Staff Mode mobile app for your front desk, and the revenue attribution dashboard. Growth is for businesses that want reviews to actually drive bookings, not just sit there.",
  },
  {
    q: "What does “Turn reviews into revenue” actually mean?",
    a: "Three concrete things. First, your reviews appear on your website with “Book Now” and “Call” buttons attached — every review becomes a conversion asset, not just a trust signal. Second, your top reviews get auto-generated as branded social cards for Xiaohongshu, Instagram, and Facebook, reaching new customers your competitors aren't reaching. Third, after every successful review, your customer gets an optional “Share with a Friend” button with a tracked referral link — every new customer attributable to a specific reviewer. The dashboard shows you exactly what's happening, in dollars.",
  },
  {
    q: "Do I need a Google Business Profile?",
    a: "Yes. We connect to your Google Business Profile during onboarding to verify your location and create the deep link to your review form. If you don't have one set up yet, we'll walk you through creating one — it's free and takes about ten minutes.",
  },
  {
    q: "Does the AI Reply Assistant work in Chinese and Spanish?",
    a: "Yes — and this is one of the places where the multilingual story really matters. If a Chinese-speaking patient leaves you a Google review in 中文, the Reply Assistant drafts your response in 中文 with natural-sounding tone. Same for Spanish. None of the major US competitors handle non-English reply drafting well — and for businesses serving immigrant communities, replying in the customer's language matters.",
  },
  {
    q: "What's the founding-customer program?",
    a: "First 50 paid signups get to lock in launch pricing forever: Starter $39 (instead of $49), Growth $89 (instead of $99), Agency $249 (instead of $499). As long as your subscription stays active, you keep those prices. Once we hit 50 founders, list prices apply universally.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access until the end of your billing period, then your account moves to read-only. We never delete your data; you can come back and reactivate anytime. Cancellation is one click in your account settings — no email required, no retention pitch.",
  },
  {
    q: "Can I switch tiers later?",
    a: "Anytime. Upgrades take effect immediately and prorate. Downgrades take effect at your next billing cycle. No fees either way.",
  },
  {
    q: "What about SMS deliverability?",
    a: "SMS in the US requires carrier registration (A2P 10DLC). We handle this for you in the background — your account ships with SMS enabled but during the registration window (typically 2–4 weeks) volume is throttled. Email-based requests work immediately at signup with no throttling.",
  },
  {
    q: "Is this only for BAAM Studio clients?",
    a: "No. BAAM Review works on any website — WordPress, Squarespace, Wix, Webflow, custom-built, or just a Google Business Profile with no website at all. We're built by BAAM Studio, but we're an independent product. If you are a BAAM Studio client, the schema markup loops back into your existing BAAM site automatically.",
  },
];

export function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="grid grid-cols-1 gap-3">
      {FAQ.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-2xl border border-border-base bg-paper"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-cream-deep"
              aria-expanded={isOpen}
            >
              <span className="font-display text-[16.5px] font-medium leading-snug tracking-[-0.01em] text-ink">
                {item.q}
              </span>
              <Plus
                className={cn(
                  "h-5 w-5 flex-shrink-0 text-text-soft transition-transform",
                  isOpen && "rotate-45",
                )}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border-soft px-6 py-5">
                <p className="font-serif text-[15.5px] leading-relaxed text-text-soft">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
