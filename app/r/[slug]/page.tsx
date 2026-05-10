import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
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
  default_language: Language;
  supported_languages: string[];
  welcome_message: Record<string, string> | null;
  prompt_questions: unknown;
  google_review_url: string | null;
  yelp_url: string | null;
  custom_url: string | null;
  custom_url_label: Record<string, string> | null;
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
  searchParams: Promise<{ t?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { t: token, lang: langOverride } = await searchParams;

  const supabase = createServiceClient();

  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, account_id, slug, display_name, brand_color, logo_url, business_type, default_language, supported_languages, welcome_message, prompt_questions, google_review_url, yelp_url, custom_url, custom_url_label",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!location) notFound();
  const loc = location as Loc;

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
  const serviceChips = getServiceChips(loc.business_type, lang, overrides);
  const descriptorChips = getDescriptorChips(lang, overrides);

  const supportedLangs = loc.supported_languages.filter(isLanguage);
  const wechat = isWeChatBrowser(userAgent);

  const ctx = {
    locationId: loc.id,
    requestId: request?.id ?? null,
    language: lang,
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
        <div className="flex items-center justify-between">
          <Brand
            displayName={loc.display_name}
            logoUrl={loc.logo_url}
            brandColor={brandColor}
            initial={initialLetter}
          />
          <LanguageSwitcher current={lang} available={supportedLangs} />
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
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-9 w-9 rounded-md object-cover"
        />
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md text-cream font-display text-[15px]"
          style={{ backgroundColor: brandColor }}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-display text-[15px] text-ink leading-tight truncate">
          {displayName}
        </p>
      </div>
    </div>
  );
}
