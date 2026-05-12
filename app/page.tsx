import Link from "next/link";
import {
  ArrowDown,
  Box,
  Globe,
  LayoutGrid,
  MessageCircle,
  Network,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { RoiCalculator } from "@/components/marketing/roi-calculator";

const FOUNDING_OPEN = process.env.FOUNDING_50_OPEN === "true";

const STAGES_TOP = [
  {
    num: "i.",
    name: "Collect",
    tier: "Starter",
    gold: false,
    icon: <Sparkles className="h-5 w-5" />,
    desc: "Three taps, an AI-assisted draft, a Google review in 60 seconds. In any of three languages.",
  },
  {
    num: "ii.",
    name: "Publish",
    tier: "Starter",
    gold: false,
    icon: <Send className="h-5 w-5" />,
    desc: "To Google, Yelp, or as a first-party testimonial. Always a private feedback path. Never gated.",
  },
  {
    num: "iii.",
    name: "Display",
    tier: "Growth",
    gold: true,
    icon: <LayoutGrid className="h-5 w-5" />,
    desc: "Reviews on your website as conversion-driving widgets with schema markup. Book / Call CTAs baked in.",
  },
  {
    num: "iv.",
    name: "Distribute",
    tier: "Growth",
    gold: true,
    icon: <Network className="h-5 w-5" />,
    desc: "Auto-generate branded social cards for Xiaohongshu, Instagram, Facebook. AI-drafted GBP posts. No US competitor touches this.",
  },
];

const STAGES_BOTTOM = [
  {
    num: "v.",
    name: "Convert",
    tier: "Growth",
    gold: true,
    icon: <TrendingUp className="h-5 w-5" />,
    desc: "Review-themed landing pages and review-grounded ad copy in your customers' real language. Reviews become bookings.",
  },
  {
    num: "vi.",
    name: "Refer",
    tier: "Growth",
    gold: true,
    icon: <Users className="h-5 w-5" />,
    desc: 'After every great review, a "Share with a Friend" link with QR card. Track every referral back to its source.',
  },
  {
    num: "vii.",
    name: "Compound",
    tier: "Growth + Agency",
    gold: true,
    icon: <Box className="h-5 w-5" />,
    desc: "Review theme mining. Best advocates surfacing. Auto-published testimonial SEO pages. Reviews become ongoing assets.",
  },
];

const FEATURES = [
  {
    tier: "Starter",
    icon: <Sparkles className="h-5 w-5" />,
    title: "AI-assisted review writing",
    desc: "Three taps from the customer become a natural-sounding draft they edit and post. Three languages. Customer is always the author of record.",
  },
  {
    tier: "Starter",
    icon: <Globe className="h-5 w-5" />,
    title: "English, Chinese, Spanish",
    desc: "Your customers leave reviews in the language they actually speak. Three languages first-class from day one — not a translated UI bolt-on. Every stage of the loop is multilingual.",
  },
  {
    tier: "Growth",
    icon: <LayoutGrid className="h-5 w-5" />,
    title: "Website widgets with CTAs",
    desc: "Reviews on the homepage, on service pages, as a floating badge — each one carrying a Book Now or Call CTA, all with Review schema markup baked in for SEO and AI engine citations.",
  },
  {
    tier: "Growth",
    icon: <Network className="h-5 w-5" />,
    title: "Xiaohongshu & social distribution",
    desc: "Top reviews auto-rendered as branded social graphics for Xiaohongshu, Instagram, Facebook — sized correctly per platform, with AI-drafted captions in the right voice for each network.",
  },
  {
    tier: "Growth",
    icon: <MessageCircle className="h-5 w-5" />,
    title: "AI Reply Assistant",
    desc: "When a Google review lands, BAAM drafts 2–3 reply options in the reviewer's language. Owner taps approve, reply posts to Google. Multilingual reply quality nothing else in the category matches.",
  },
  {
    tier: "Growth",
    icon: <Users className="h-5 w-5" />,
    title: "Share-with-a-friend referrals",
    desc: "After every great review, an optional share card with a tracked referral link. Customer sends via WeChat, SMS, or Xiaohongshu. Every new customer attributable to a specific reviewer.",
  },
  {
    tier: "Growth",
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Revenue attribution dashboard",
    desc: "See exactly what BAAM Review is doing for your business in dollars: reviews, widget views, CTA clicks, referrals, and an estimated revenue impact updated daily. The anti-churn surface.",
  },
  {
    tier: "Starter",
    icon: <Box className="h-5 w-5" />,
    title: "Compliance, on rails",
    desc: "No review gating, no incentive features that violate Google's policies, TCPA-compliant SMS templates with opt-out built in, FTC-aligned consent layer for testimonial reuse. We sweat the rules so you don't.",
  },
];

export default function MarketingHome() {
  return (
    <>
      <MarketingNav />

      {/* ============ HERO ============ */}
      <section className="relative px-6 pb-24 pt-16 sm:pt-20 lg:pb-28">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <span className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border-base bg-cream-deep px-3.5 py-1.5 pl-2 text-[13px] text-text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" />
              The Review-to-Revenue Engine for local businesses
            </span>

            <h1 className="font-display text-[44px] font-normal leading-[0.98] tracking-[-0.035em] text-ink sm:text-[58px] lg:text-[72px]">
              Turn happy customers into{" "}
              <em className="font-light italic text-forest">reviews</em>,{" "}
              <em className="font-light italic text-gold">referrals</em>, &{" "}
              <em className="font-light italic text-forest">revenue</em>.
            </h1>

            <p className="mt-7 max-w-[540px] font-serif text-[20px] leading-[1.5] text-text-soft sm:text-[21px]">
              Most review tools stop at collection. BAAM Review owns the whole
              loop — collect Google reviews in 60 seconds, display them on your
              website to convert visitors, distribute to Xiaohongshu and social,
              and turn happy customers into referrals. Three languages, from
              $49 a month.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-forest px-7 py-4 text-[15.5px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark hover:shadow-md"
              >
                Start free trial →
              </Link>
              <Link
                href="#roi"
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15.5px] font-medium text-text transition-colors hover:bg-cream-deep"
              >
                See your ROI
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3.5 text-[13px] text-text-muted">
              <span>14-day trial</span>
              <span className="h-px w-6 bg-border-base" />
              <span>No credit card</span>
              <span className="h-px w-6 bg-border-base" />
              <span>EN / 中文 / ES</span>
              <span className="h-px w-6 bg-border-base" />
              <span>Five-minute setup</span>
            </div>
          </div>

          <PhoneMockup />
        </div>
      </section>

      {/* ============ THESIS PULL QUOTE ============ */}
      <div className="bg-cream-deep py-20 sm:py-24">
        <div className="mx-auto max-w-[1240px] px-6 text-center">
          <p className="font-display text-[120px] font-light leading-none text-gold/40">
            “
          </p>
          <p className="mx-auto -mt-12 max-w-[820px] font-display text-[26px] font-light leading-[1.4] tracking-[-0.015em] text-ink sm:text-[34px]">
            Reviews are not the end goal. Reviews are the{" "}
            <em className="italic text-forest">raw material</em> for trust,
            content, SEO, referrals, and revenue. BAAM Review is the engine
            that turns the one into the others.
          </p>
        </div>
      </div>

      {/* ============ SEVEN-STAGE LOOP ============ */}
      <section id="loop" className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeaderCenter
            eyebrow="The Review-to-Revenue Loop"
            titleStart="Seven stages."
            titleEm="One product."
            sub="Most review tools do one or two of these. We do all seven, in three languages, in one place. That's the difference between a $39 review collection tool and a $99 customer growth engine."
          />

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES_TOP.map((s) => (
              <StageCard key={s.num} stage={s} />
            ))}
          </div>

          <div className="my-7 flex justify-center text-forest/40">
            <ArrowDown className="h-8 w-8" />
          </div>

          <div className="mx-auto grid max-w-[930px] grid-cols-1 gap-4 sm:grid-cols-3">
            {STAGES_BOTTOM.map((s) => (
              <StageCard key={s.num} stage={s} />
            ))}
          </div>

          <p className="mx-auto mt-14 max-w-[760px] text-center font-serif text-[17px] italic leading-relaxed text-text-soft">
            Starter unlocks stages <strong className="not-italic">i &amp; ii</strong>.{" "}
            Growth unlocks{" "}
            <strong className="not-italic">iii through vi</strong>. Agency adds{" "}
            <strong className="not-italic">vii at scale</strong> across many
            client accounts. Every stage compounds the last.
          </p>
        </div>
      </section>

      {/* ============ PROBLEM / SOLUTION CONTRAST ============ */}
      <div className="relative overflow-hidden bg-ink px-6 py-24 text-cream sm:py-28">
        <div className="pointer-events-none absolute right-[-10%] top-[-10%] h-[400px] w-[400px] rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-15%] left-[-10%] h-[400px] w-[400px] rounded-full bg-forest/30 blur-3xl" />
        <div className="relative mx-auto max-w-[1240px]">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-gold">
            The category problem
          </p>
          <h2 className="max-w-[800px] font-display text-[38px] font-normal leading-[1.05] tracking-[-0.025em] text-cream sm:text-[52px]">
            Other tools collect reviews.
            <br />
            <em className="italic text-gold">We turn them into revenue.</em>
          </h2>
          <p className="mt-6 max-w-[780px] font-serif text-[18px] leading-relaxed text-cream/70 sm:text-[20px]">
            Birdeye costs $299+ and stops at &ldquo;monitor your reviews.&rdquo;
            Podium is sales-led and English-only. NiceJob is solid but ends
            where we begin. None of them close the loop into referrals,
            distribution, and compound growth.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <CompareCol
              tone="them"
              title="What other tools do"
              items={[
                "Send review requests and hope customers complete them",
                "Aggregate reviews from many platforms into a dashboard",
                "Stop there. The reviews sit. Customers don't refer. Nothing compounds.",
                "English-only or English-first. Spanish translated. Chinese rarely supported.",
                "$299–$599 per month, plus $500–$1,500 setup fees, sales-led",
              ]}
            />
            <CompareCol
              tone="us"
              title="What BAAM Review does"
              items={[
                "AI-assisted writing flow gets 3× the completion rate vs. blank Google forms",
                "Display widget with conversion CTAs and schema markup, on every website",
                "Auto-distributes top reviews to Xiaohongshu, Instagram, Facebook, GBP",
                "Share-with-a-Friend referral link after every successful review",
                "Three languages, self-serve signup, $49–99/mo, no sales calls",
              ]}
            />
          </div>
        </div>
      </div>

      {/* ============ WEDGE FEATURE — completion rate ============ */}
      <section className="bg-paper px-6 py-24 sm:py-28">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-text-muted">
              The wedge feature
            </p>
            <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[48px]">
              Customers <em className="italic text-forest">actually finish</em>{" "}
              the review.
            </h2>
            <p className="mt-6 max-w-[520px] font-serif text-[18px] leading-relaxed text-text-soft sm:text-[20px]">
              Three chip questions. AI generates a natural draft in their
              language. They edit, tap once, and post to Google. Sixty seconds.
              The result is a completion rate the rest of the category cannot
              match.
            </p>
          </div>
          <div className="space-y-7">
            <WedgeStat
              num="~10%"
              gold={false}
              text="Of customers who click a typical “leave a review” link actually finish writing one. The category-wide reality."
            />
            <WedgeStat
              num="38%"
              gold
              text="Average completion rate on BAAM Review’s AI-assisted flow. Roughly 3.8× the category average."
            />
            <WedgeStat
              num="60s"
              gold
              text="Average time from receiving SMS to a posted Google review."
            />
          </div>
        </div>
      </section>

      {/* ============ LANGUAGES ============ */}
      <section id="languages" className="bg-cream-deep px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeaderCenter
            eyebrow="First-class multilingual"
            titleStart="Three languages."
            titleEm="Same loop."
            sub="A natural-sounding review draft from the same three inputs — what we helped you with, how it went, one word for us — rendered fluently in the language your customer chooses. Every stage of the loop is multilingual. No major US competitor does this."
          />

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            <LanguageCard
              label="English"
              labelClass="text-gold"
              borderClass="border-t-gold"
              quote='"Came in for chronic migraines and after three sessions I&apos;m sleeping through the night again. Dr. Huang takes her time, explains everything, and genuinely listens. The clinic is calm and clean. Worth the trip from Manhattan."'
              meta="· Posted to Google"
            />
            <LanguageCard
              label="中文"
              labelClass="text-[#B5443A]"
              borderClass="border-t-[#B5443A]"
              quote='"因为偏头痛来的，三次治疗后晚上终于能睡整觉了。黄医生很耐心，会仔细听你说，解释也很清楚。诊所环境安静干净。从曼哈顿过来值得。"'
              meta="· 已发布到 Google"
            />
            <LanguageCard
              label="Español"
              labelClass="text-[#D4924A]"
              borderClass="border-t-[#D4924A]"
              quote='"Vine por migrañas crónicas y después de tres sesiones vuelvo a dormir toda la noche. La Dra. Huang se toma su tiempo, explica todo y realmente escucha. El consultorio es tranquilo y limpio. Vale el viaje desde Manhattan."'
              meta="· Publicado en Google"
            />
          </div>
        </div>
      </section>

      {/* ============ ROI CALCULATOR ============ */}
      <section id="roi" className="px-6 py-24 sm:py-28">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p
              className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em]"
              style={{ color: "#836A30" }}
            >
              What does this actually do for revenue?
            </p>
            <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[48px]">
              Reviews are <em className="italic text-forest">worth</em>{" "}
              something. Let&apos;s calculate.
            </h2>
            <p className="mt-6 max-w-[520px] font-serif text-[18px] leading-relaxed text-text-soft sm:text-[20px]">
              A Google review is worth $50–200 in lifetime customer value for
              most local businesses. More reviews mean better SEO, better
              trust, more bookings. Adjust the sliders and see what your number
              looks like.
            </p>
            <p className="mt-5 max-w-[520px] font-serif text-[15px] leading-relaxed text-text-soft">
              The math assumes a conservative 5% lift in monthly customers from
              going from 3 reviews/month to 15 reviews/month — well below what
              most BAAM Review customers see in practice.
            </p>
          </div>
          <RoiCalculator />
        </div>
      </section>

      {/* ============ FEATURES BY STAGE ============ */}
      <section className="bg-paper px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[1240px]">
          <SectionHeaderCenter
            eyebrow="A small set of well-considered features"
            titleStart="Each one closes a"
            titleEm="different gap."
            sub="No feature creep. Each capability earns its place by closing a measurable gap in the loop. Starter ships you the wedge. Growth completes the engine."
          />

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ BAAM STACK ============ */}
      <section id="agencies" className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid grid-cols-1 items-center gap-12 rounded-[28px] border border-border-base bg-paper p-10 shadow-md sm:p-14 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
            <div>
              <p
                className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em]"
                style={{ color: "#836A30" }}
              >
                For BAAM Studio clients
              </p>
              <h3 className="font-display text-[28px] font-normal leading-[1.15] tracking-[-0.02em] text-ink sm:text-[34px]">
                The reputation layer of your{" "}
                <em className="italic text-forest">
                  market presence system.
                </em>
              </h3>
              <p className="mt-5 font-serif text-[17px] leading-relaxed text-text-soft">
                If you&apos;re already on BAAM Platform, BAAM Review fits as
                the reputation and revenue layer. Reviews feed into your
                website schema markup, lift your GEO scores, generate
                Xiaohongshu and Instagram content, and turn happy customers
                into referrals — all connected to the same content engine you
                already use.
              </p>
            </div>
            <div className="space-y-2.5">
              {[
                { name: "BAAM Platform", highlight: false, arrow: "→" },
                { name: "BAAM Review", highlight: true, arrow: "●" },
                { name: "BAAM Local", highlight: false, arrow: "→" },
                { name: "BAAM SEO", highlight: false, arrow: "→" },
              ].map((s) => (
                <div
                  key={s.name}
                  className={
                    s.highlight
                      ? "flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-cream"
                      : "flex items-center gap-3 rounded-2xl border border-border-base bg-cream-deep px-5 py-4 text-ink"
                  }
                >
                  <span
                    className={
                      s.highlight
                        ? "flex h-7 w-7 items-center justify-center rounded-md bg-gold text-[12px] font-semibold text-ink"
                        : "flex h-7 w-7 items-center justify-center rounded-md bg-forest text-[12px] font-semibold text-cream"
                    }
                  >
                    B
                  </span>
                  <span className="flex-1 font-display text-[16px] font-medium tracking-[-0.01em]">
                    {s.name}
                  </span>
                  <span
                    className={
                      s.highlight ? "text-[16px] text-gold" : "text-text-muted"
                    }
                  >
                    {s.arrow}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ PRICING TEASER ============ */}
      <div className="relative overflow-hidden bg-forest px-6 py-24 text-cream sm:py-28">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[500px] w-[500px] rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-sage/20 blur-3xl" />
        <div className="relative mx-auto max-w-[1240px] text-center">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-gold">
            Three tiers, one engine
          </p>
          <h2 className="mx-auto max-w-[820px] font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-cream sm:text-[52px]">
            Pricing that respects <em className="italic">where you are.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-[660px] font-serif text-[18px] leading-relaxed text-cream/80 sm:text-[19px]">
            Self-serve. Transparent. No sales calls. From $0 to $499, with an
            explicit founding-customer program for the first 50 paid signups.
          </p>

          <div className="mx-auto mt-12 grid max-w-[980px] grid-cols-1 gap-4 md:grid-cols-3">
            <TierMini
              name="Starter"
              tag="Get more Google reviews."
              price="$49"
              feature="1 location, 150 requests/mo, AI writing, QR + embed"
            />
            <TierMini
              featured
              name="Growth"
              tag="Turn reviews into revenue."
              price="$99"
              feature="5 locations, unlimited, full loop, attribution dashboard"
            />
            <TierMini
              name="Agency"
              tag="Reputation at scale."
              price="$499"
              feature="25 locations, white label, partner referrals, multi-client view"
            />
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-4 text-[15.5px] font-medium text-ink transition-all hover:-translate-y-px hover:bg-[#B8985A]"
            >
              See full pricing →
            </Link>
            {FOUNDING_OPEN && (
              <span className="inline-flex items-center gap-2 text-[13.5px] text-cream/70">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                Founding-customer pricing locked at $39 / $89 / $249 — first 50
                only.
              </span>
            )}
          </div>
        </div>
      </div>

      <MarketingFooter />
    </>
  );
}

function SectionHeaderCenter({
  eyebrow,
  titleStart,
  titleEm,
  sub,
}: {
  eyebrow: string;
  titleStart: string;
  titleEm: string;
  sub: string;
}) {
  return (
    <div className="mx-auto max-w-[760px] text-center">
      <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-text-muted">
        {eyebrow}
      </p>
      <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-ink sm:text-[48px]">
        {titleStart} <em className="italic text-forest">{titleEm}</em>
      </h2>
      <p className="mx-auto mt-6 max-w-[640px] font-serif text-[18px] leading-relaxed text-text-soft sm:text-[20px]">
        {sub}
      </p>
    </div>
  );
}

function StageCard({
  stage,
}: {
  stage: {
    num: string;
    name: string;
    tier: string;
    gold: boolean;
    icon: React.ReactNode;
    desc: string;
  };
}) {
  return (
    <div
      className={
        stage.gold
          ? "relative flex flex-col gap-3 rounded-2xl border border-gold/50 bg-paper p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          : "relative flex flex-col gap-3 rounded-2xl border border-border-base bg-paper p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            stage.gold
              ? "flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold"
              : "flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest"
          }
        >
          {stage.icon}
        </span>
        <span className="font-display text-[14px] italic text-text-muted">
          {stage.num}
        </span>
      </div>
      <h3 className="font-display text-[22px] font-normal leading-tight tracking-[-0.015em] text-ink">
        {stage.name}
      </h3>
      <p className="flex-1 text-[14px] leading-relaxed text-text-soft">
        {stage.desc}
      </p>
      <span
        className={
          stage.gold
            ? "inline-flex w-fit items-center rounded-full bg-gold/15 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#836A30]"
            : "inline-flex w-fit items-center rounded-full bg-forest/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-forest"
        }
      >
        {stage.tier}
      </span>
    </div>
  );
}

function CompareCol({
  tone,
  title,
  items,
}: {
  tone: "them" | "us";
  title: string;
  items: string[];
}) {
  const isUs = tone === "us";
  return (
    <div
      className={
        isUs
          ? "rounded-2xl border border-gold/40 bg-cream/5 p-8"
          : "rounded-2xl border border-cream/15 bg-cream/[0.03] p-8"
      }
    >
      <h3
        className={
          isUs
            ? "mb-6 font-display text-[20px] font-medium tracking-[-0.01em] text-gold"
            : "mb-6 font-display text-[20px] font-medium tracking-[-0.01em] text-cream/60"
        }
      >
        {title}
      </h3>
      <ul className="space-y-4">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-3">
            <span
              className={
                isUs
                  ? "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold text-ink"
                  : "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cream/10 text-cream/40"
              }
            >
              {isUs ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="text-[14px] leading-none">—</span>
              )}
            </span>
            <span
              className={
                isUs
                  ? "text-[15px] leading-relaxed text-cream/90"
                  : "text-[15px] leading-relaxed text-cream/55"
              }
            >
              {it}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WedgeStat({
  num,
  gold,
  text,
}: {
  num: string;
  gold: boolean;
  text: string;
}) {
  return (
    <div className="flex items-baseline gap-6 border-b border-border-soft pb-7 last:border-0">
      <p
        className={
          gold
            ? "font-display text-[56px] font-light leading-none tracking-[-0.03em] text-gold"
            : "font-display text-[56px] font-light leading-none tracking-[-0.03em] text-text-muted"
        }
      >
        {num}
      </p>
      <p className="flex-1 font-serif text-[16px] leading-relaxed text-text-soft">
        {text}
      </p>
    </div>
  );
}

function LanguageCard({
  label,
  labelClass,
  borderClass,
  quote,
  meta,
}: {
  label: string;
  labelClass: string;
  borderClass: string;
  quote: string;
  meta: string;
}) {
  return (
    <div
      className={`rounded-2xl border-l border-r border-b border-t-2 border-border-base bg-paper p-7 shadow-sm ${borderClass}`}
    >
      <p
        className={`mb-4 font-display text-[12.5px] font-medium uppercase tracking-[0.14em] ${labelClass}`}
      >
        {label}
      </p>
      <p className="mb-5 font-display text-[16.5px] italic leading-[1.55] text-text">
        {quote}
      </p>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="tracking-[2px] text-gold">★★★★★</span>
        <span className="text-text-muted">{meta}</span>
      </div>
    </div>
  );
}

function FeatureCard({
  tier,
  icon,
  title,
  desc,
}: {
  tier: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const isGrowth = tier === "Growth";
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border-base bg-cream-deep p-7 transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper text-forest">
          {icon}
        </span>
        <span
          className={
            isGrowth
              ? "inline-flex w-fit items-center rounded-full bg-gold/15 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#836A30]"
              : "inline-flex w-fit items-center rounded-full bg-forest/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-forest"
          }
        >
          {tier}
        </span>
      </div>
      <h3 className="font-display text-[20px] font-normal leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h3>
      <p className="text-[14.5px] leading-relaxed text-text-soft">{desc}</p>
    </div>
  );
}

function TierMini({
  name,
  tag,
  price,
  feature,
  featured = false,
}: {
  name: string;
  tag: string;
  price: string;
  feature: string;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "rounded-2xl border-2 border-gold/70 bg-cream/10 p-7 text-left shadow-md backdrop-blur-sm"
          : "rounded-2xl border border-cream/15 bg-cream/[0.05] p-7 text-left backdrop-blur-sm"
      }
    >
      <p
        className={
          featured
            ? "mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-gold"
            : "mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-cream/60"
        }
      >
        {name}
      </p>
      <p className="mb-5 font-serif text-[15px] italic text-cream/85">{tag}</p>
      <p className="font-display text-[40px] font-light leading-none tracking-[-0.025em]">
        {price}
        <span className="ml-1 font-sans text-[14px] font-normal text-cream/55">
          /mo
        </span>
      </p>
      <p className="mt-5 text-[13.5px] leading-relaxed text-cream/70">
        {feature}
      </p>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="rounded-[44px] border border-border-base bg-paper p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[36px] bg-cream">
          <div className="flex items-center justify-between px-5 py-2.5 text-[12px] font-semibold text-ink">
            <span>9:41</span>
            <span className="flex items-center gap-1.5 text-text-muted">
              ▮▮▮▮
            </span>
          </div>
          <div className="px-6 py-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#962D22] font-display text-[18px] font-semibold text-cream">
                黄
              </span>
              <div>
                <p className="font-display text-[15px] text-ink">
                  Dr. Huang Acupuncture
                </p>
                <p className="text-[12px] text-text-muted">Flushing, NY</p>
              </div>
            </div>

            <h2 className="font-display text-[24px] font-normal leading-tight text-ink">
              Thanks for visiting,
              <br />
              <em className="italic text-forest">Sarah.</em>
            </h2>

            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
              Question 1 of 3
            </p>
            <p className="mt-1.5 text-[14.5px] text-text">
              What did we help you with today?
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Back pain", selected: false },
                { label: "Migraines", selected: true },
                { label: "Stress", selected: false },
                { label: "Insomnia", selected: false },
                { label: "Allergies", selected: false },
                { label: "Other…", selected: false },
              ].map((c) => (
                <span
                  key={c.label}
                  className={
                    c.selected
                      ? "rounded-full border border-forest bg-forest/[0.06] px-3.5 py-1.5 text-[12.5px] font-medium text-forest"
                      : "rounded-full border border-border-base bg-paper px-3.5 py-1.5 text-[12.5px] text-text"
                  }
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-border-soft px-6 py-4">
            <div className="mb-3 h-1 w-full rounded-full bg-cream-deep">
              <div className="h-1 w-1/3 rounded-full bg-forest" />
            </div>
            <button
              type="button"
              className="w-full rounded-full bg-forest py-3 text-[13.5px] font-medium text-cream"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 pt-4">
        <Star className="h-3 w-3 fill-gold text-gold" />
        <Star className="h-3 w-3 fill-gold text-gold" />
        <Star className="h-3 w-3 fill-gold text-gold" />
        <Star className="h-3 w-3 fill-gold text-gold" />
        <Star className="h-3 w-3 fill-gold text-gold" />
        <span className="ml-1 text-[11.5px] text-text-muted">
          Live on 5 locations
        </span>
      </div>
    </div>
  );
}
