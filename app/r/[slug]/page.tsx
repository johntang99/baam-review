import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { getLocationBillingState } from "@/lib/billing/access";
import {
  STRINGS,
  pickLanguage,
  isLanguage,
  type Language,
} from "@/lib/i18n/review";
import {
  getServiceChips,
  getDescriptorChips,
  parsePromptQuestions,
} from "@/lib/business-prompts";
import { isWeChatBrowser } from "@/lib/wechat";
import { ReviewFlow } from "@/components/review/review-flow";
import { LanguageSwitcher } from "@/components/review/language-switcher";
import { WeChatHint } from "@/components/review/wechat-hint";

export const dynamic = "force-dynamic";

type Loc = {
  id: string;
  account_id: string;
  slug: string;
  display_name: string;
  brand_color: string | null;
  logo_url: string | null;
  business_type: string | null;
  review_category: string;
  default_language: Language;
  supported_languages: string[];
  welcome_message: Record<string, string> | null;
  prompt_questions: unknown;
  google_review_url: string | null;
  yelp_url: string | null;
  custom_url: string | null;
  custom_url_label: Record<string, string> | null;
  consent_display_enabled: boolean;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("locations")
    .select("display_name")
    .eq("slug", slug)
    .maybeSingle();
  return {
    title: data?.display_name
      ? `Leave a review for ${data.display_name}`
      : "Leave a review",
  };
}

export default async function ReviewLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    t?: string;
    lang?: string;
    source?: string;
    ref?: string;
  }>;
}) {
  const { slug } = await params;
  const {
    t: token,
    lang: langOverride,
    source,
    ref: refParam,
  } = await searchParams;

  const supabase = createServiceClient();

  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, account_id, slug, display_name, brand_color, logo_url, business_type, review_category, default_language, supported_languages, welcome_message, prompt_questions, google_review_url, yelp_url, custom_url, custom_url_label, consent_display_enabled",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!location) notFound();
  const loc = location as Loc;

  // Billing gate: an unbilled location's public review page is treated as
  // not found (neutral, no billing-status leak to visitors).
  const gate = await getLocationBillingState(loc.id);
  if (!gate.allowed) notFound();

  let request:
    | { id: string; language: string | null }
    | null = null;
  if (token) {
    const { data: r } = await supabase
      .from("review_requests")
      .select("id, language, location_id")
      .eq("tracking_token", token)
      .maybeSingle();
    if (r && r.location_id === loc.id) {
      request = { id: r.id, language: r.language };
    }
  }

  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const userAgent = headersList.get("user-agent");

  const lang: Language =
    isLanguage(langOverride) && loc.supported_languages.includes(langOverride)
      ? (langOverride as Language)
      : pickLanguage({
          request,
          acceptLanguage,
          supported: loc.supported_languages,
          fallback: loc.default_language,
        });

  const s = STRINGS[lang];
  const welcome = loc.welcome_message?.[lang] || s.welcome_default;
  const customLabel = loc.custom_url_label?.[lang] || null;

  const overrides = parsePromptQuestions(loc.prompt_questions);
  const serviceChips = getServiceChips(loc.review_category, lang, overrides);
  const descriptorChips = getDescriptorChips(
    loc.review_category,
    lang,
    overrides,
  );

  const supportedLangs = loc.supported_languages.filter(isLanguage);
  const wechat = isWeChatBrowser(userAgent);

  const sanitizedSource =
    typeof source === "string" && source
      ? source.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, "")
      : null;

  // Referral attribution: ?ref=<advocate_request_id> carried over from
  // /s/<token> or a share-card click. Validate it points at a real request
  // for this location before threading it through to the client.
  let referredBy: string | null = null;
  if (refParam && /^[0-9a-fA-F-]{32,36}$/.test(refParam)) {
    const { data: advocate } = await supabase
      .from("review_requests")
      .select("id, location_id")
      .eq("id", refParam)
      .maybeSingle();
    if (advocate && advocate.location_id === loc.id) {
      referredBy = advocate.id;
      // Server-side review_started event so the referral leaderboard has
      // signal even if the visitor closes the tab before posting.
      await supabase.from("referrals").insert({
        location_id: loc.id,
        advocate_request_id: advocate.id,
        event_type: "review_started",
        referrer_host: headersList.get("referer")
          ? safeHost(headersList.get("referer"))
          : null,
        user_agent: userAgent?.slice(0, 500) ?? null,
      });
    }
  }

  const ctx = {
    locationId: loc.id,
    requestId: request?.id ?? null,
    language: lang,
    source: sanitizedSource,
    referredBy,
  };

  const initialLetter = loc.display_name.charAt(0).toUpperCase();
  const brandColor = loc.brand_color ?? "#1F4D3F";

  const feedbackParams = new URLSearchParams();
  if (token) feedbackParams.set("t", token);
  feedbackParams.set("lang", lang);
  const privateFeedbackHref = `/r/${loc.slug}/feedback?${feedbackParams.toString()}`;

  return (
    <main className="min-h-screen bg-cream py-6 px-4 sm:py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-3">
          <Brand
            displayName={loc.display_name}
            logoUrl={loc.logo_url}
            brandColor={brandColor}
            initial={initialLetter}
          />
          {supportedLangs.length > 1 && (
            <div className="border-t border-border-soft pt-3">
              <LanguageSwitcher current={lang} available={supportedLangs} />
            </div>
          )}
        </div>

        <p className="text-[15px] text-text leading-relaxed">{welcome}</p>

        {wechat && <WeChatHint ctx={ctx} lang={lang} />}

        <div className="rounded-2xl border border-border-base bg-paper p-5 sm:p-6 shadow-sm">
          <ReviewFlow
            ctx={ctx}
            lang={lang}
            slug={loc.slug}
            serviceChips={serviceChips}
            descriptorChips={descriptorChips}
            googleReviewUrl={loc.google_review_url}
            yelpUrl={loc.yelp_url}
            customUrl={loc.custom_url}
            customUrlLabel={customLabel}
            privateFeedbackHref={privateFeedbackHref}
            consentDisplayEnabled={loc.consent_display_enabled}
            trackingToken={token ?? null}
          />
        </div>

        <p className="text-center text-[11px] text-text-muted">
          Powered by BAAM Review
        </p>
      </div>
    </main>
  );
}

function Brand({
  displayName,
  logoUrl,
  brandColor,
  initial,
}: {
  displayName: string;
  logoUrl: string | null;
  brandColor: string;
  initial: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-cream font-display text-[16px]"
          style={{ backgroundColor: brandColor }}
        >
          {initial}
        </span>
      )}
      <p className="font-display text-[17px] text-ink leading-snug">
        {displayName}
      </p>
    </div>
  );
}

function safeHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.slice(0, 200);
  } catch {
    return null;
  }
}
